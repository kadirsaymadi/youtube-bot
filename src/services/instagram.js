import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import config from '../config/index.js';
import { InstagramVideo } from '../models/InstagramVideo.js';
import logger from '../utils/logger.js';
import { ensureDir, runCommand, sanitizeFilename, getTimestamp } from '../utils/helpers.js';

function detectSourceType(url) {
  if (url.includes('/reel/')) return 'reel';
  if (url.match(/instagram\.com\/[^/]+\/?$/)) return 'profile';
  return 'post';
}

function parseJsonOutput(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const lines = stdout.trim().split('\n');
    for (const line of lines.reverse()) {
      try {
        return JSON.parse(line);
      } catch {
        continue;
      }
    }
    return null;
  }
}

export class InstagramService {
  constructor(downloadDir = config.downloadDir) {
    this.downloadDir = downloadDir;
  }

  async getVideoInfo(url) {
    const { stdout } = await runCommand('yt-dlp', [
      '--dump-json',
      '--no-download',
      '--no-warnings',
      url,
    ]);

    const info = parseJsonOutput(stdout);
    if (!info) {
      throw new Error(`Video bilgisi alınamadı: ${url}`);
    }
    return info;
  }

  async listProfileVideos(profileUrl, limit = 10) {
    const { stdout } = await runCommand('yt-dlp', [
      '--flat-playlist',
      '--dump-json',
      '--playlist-end',
      String(limit),
      '--no-warnings',
      profileUrl,
    ]);

    const entries = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return entries;
  }

  async downloadVideo(url, jobId = null) {
    await ensureDir(this.downloadDir);

    const sourceType = detectSourceType(url);
    let videoRecord = await InstagramVideo.findOne({ sourceUrl: url });

    if (videoRecord?.status === 'downloaded' && videoRecord.localPath) {
      logger.info('Video zaten indirilmiş, atlanıyor', { url });
      return videoRecord;
    }

    if (!videoRecord) {
      videoRecord = await InstagramVideo.create({
        sourceUrl: url,
        sourceType,
        status: 'downloading',
      });
    } else {
      videoRecord.status = 'downloading';
      videoRecord.errorMessage = undefined;
      await videoRecord.save();
    }

    try {
      const info = await this.getVideoInfo(url);
      const outputTemplate = path.join(
        this.downloadDir,
        `${sanitizeFilename(info.id || getTimestamp())}.%(ext)s`
      );

      await runCommand('yt-dlp', [
        '-f',
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--merge-output-format',
        'mp4',
        '-o',
        outputTemplate,
        '--no-warnings',
        url,
      ]);

      const files = await readdir(this.downloadDir);
      const matchingFile = files.find((f) => f.startsWith(sanitizeFilename(info.id || '')) || f.includes(info.id));

      let localPath = null;
      if (matchingFile) {
        localPath = path.join(this.downloadDir, matchingFile);
      } else {
        const mp4Files = files.filter((f) => f.endsWith('.mp4'));
        const latest = await this.findLatestFile(mp4Files);
        localPath = latest ? path.join(this.downloadDir, latest) : null;
      }

      if (!localPath) {
        throw new Error('İndirilen dosya bulunamadı');
      }

      const fileStats = await stat(localPath);

      videoRecord.instagramId = info.id;
      videoRecord.title = info.title || info.description?.slice(0, 100);
      videoRecord.description = info.description;
      videoRecord.localPath = localPath;
      videoRecord.thumbnailUrl = info.thumbnail;
      videoRecord.duration = info.duration;
      videoRecord.fileSize = fileStats.size;
      videoRecord.status = 'downloaded';
      videoRecord.metadata = {
        uploader: info.uploader,
        uploadDate: info.upload_date,
        viewCount: info.view_count,
        jobId,
      };
      await videoRecord.save();

      logger.info('Video indirildi', { url, localPath });
      return videoRecord;
    } catch (error) {
      videoRecord.status = 'failed';
      videoRecord.errorMessage = error.message;
      await videoRecord.save();
      logger.error('Video indirme hatası', { url, error: error.message });
      throw error;
    }
  }

  async findLatestFile(files) {
    if (files.length === 0) return null;

    let latest = files[0];
    let latestTime = 0;

    for (const file of files) {
      const filePath = path.join(this.downloadDir, file);
      const stats = await stat(filePath);
      if (stats.mtimeMs > latestTime) {
        latestTime = stats.mtimeMs;
        latest = file;
      }
    }
    return latest;
  }

  async downloadFromSources(sources = config.instagramSources, limitPerSource = 5) {
    const downloadedVideos = [];

    for (const source of sources) {
      const sourceType = detectSourceType(source);

      try {
        if (sourceType === 'profile') {
          const entries = await this.listProfileVideos(source, limitPerSource);
          for (const entry of entries) {
            const videoUrl = entry.url || entry.webpage_url || `https://www.instagram.com/p/${entry.id}/`;
            try {
              const video = await this.downloadVideo(videoUrl);
              downloadedVideos.push(video);
            } catch (err) {
              logger.warn('Profil videosu indirilemedi', { videoUrl, error: err.message });
            }
          }
        } else {
          const video = await this.downloadVideo(source);
          downloadedVideos.push(video);
        }
      } catch (error) {
        logger.error('Kaynak işlenemedi', { source, error: error.message });
      }
    }

    return downloadedVideos;
  }

  async cleanupDownloaded(olderThanDays = 7) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const oldVideos = await InstagramVideo.find({
      status: { $in: ['merged', 'uploaded'] },
      updatedAt: { $lt: cutoff },
    });

    for (const video of oldVideos) {
      if (video.localPath) {
        try {
          await unlink(video.localPath);
        } catch {
          // dosya zaten silinmiş olabilir
        }
      }
      video.localPath = undefined;
      await video.save();
    }

    logger.info('Eski indirmeler temizlendi', { count: oldVideos.length });
  }
}

export default new InstagramService();
