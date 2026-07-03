import { Job } from '../models/Job.js';
import { InstagramVideo } from '../models/InstagramVideo.js';
import instagramService from './instagram.js';
import mergerService from './merger.js';
import youtubeService from './youtube.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

async function addJobLog(job, message) {
  job.logs.push({ message, timestamp: new Date() });
  await job.save();
}

export class PipelineService {
  async runFullPipeline(options = {}) {
    const {
      sources = config.instagramSources,
      limitPerSource = options.limitPerSource || 5,
      title = options.title,
      description = options.description,
      tags = options.tags,
      privacyStatus = options.privacyStatus,
    } = options;

    const job = await Job.create({
      type: 'full_pipeline',
      status: 'running',
      startedAt: new Date(),
    });

    try {
      await addJobLog(job, 'Instagram videoları indiriliyor...');
      logger.info('Pipeline başlatıldı', { jobId: job._id });

      const downloadedVideos = await instagramService.downloadFromSources(sources, limitPerSource);
      const successfulVideos = downloadedVideos.filter((v) => v.status === 'downloaded' && v.localPath);

      if (successfulVideos.length === 0) {
        throw new Error('İndirilebilir video bulunamadı');
      }

      job.videoIds = successfulVideos.map((v) => v._id);
      await addJobLog(job, `${successfulVideos.length} video indirildi`);

      const videoPaths = successfulVideos.map((v) => v.localPath);
      await addJobLog(job, 'Videolar birleştiriliyor...');

      const mergedPath = await mergerService.mergeVideos(videoPaths);
      job.mergedVideoPath = mergedPath;
      await addJobLog(job, `Videolar birleştirildi: ${mergedPath}`);

      for (const video of successfulVideos) {
        video.status = 'merged';
        await video.save();
      }

      await addJobLog(job, 'YouTube\'a yükleniyor...');

      const defaultTitle = title || `${config.youtube.defaultTitle} - ${new Date().toLocaleDateString('tr-TR')}`;
      const uploadResult = await youtubeService.uploadVideo(mergedPath, {
        title: defaultTitle,
        description,
        tags,
        privacyStatus,
        jobId: job._id,
        sourceVideoCount: successfulVideos.length,
      });

      job.youtubeVideoId = uploadResult.videoId;
      job.youtubeUrl = uploadResult.youtubeUrl;
      job.status = 'completed';
      job.completedAt = new Date();
      await addJobLog(job, `YouTube yükleme tamamlandı: ${uploadResult.youtubeUrl}`);

      for (const video of successfulVideos) {
        video.status = 'uploaded';
        await video.save();
      }

      logger.info('Pipeline tamamlandı', {
        jobId: job._id,
        youtubeUrl: uploadResult.youtubeUrl,
      });

      return {
        job,
        downloadedCount: successfulVideos.length,
        mergedPath,
        youtubeUrl: uploadResult.youtubeUrl,
        youtubeVideoId: uploadResult.videoId,
      };
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error.message;
      job.completedAt = new Date();
      await addJobLog(job, `Hata: ${error.message}`);
      await job.save();

      logger.error('Pipeline hatası', { jobId: job._id, error: error.message });
      throw error;
    }
  }

  async runDownloadOnly(sources, limitPerSource = 5) {
    const job = await Job.create({
      type: 'download',
      status: 'running',
      startedAt: new Date(),
    });

    try {
      const videos = await instagramService.downloadFromSources(sources, limitPerSource);
      const successful = videos.filter((v) => v.status === 'downloaded');

      job.videoIds = successful.map((v) => v._id);
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();

      return { job, videos: successful };
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error.message;
      job.completedAt = new Date();
      await job.save();
      throw error;
    }
  }

  async runMergeAndUpload(videoIds, options = {}) {
    const job = await Job.create({
      type: 'upload',
      status: 'running',
      startedAt: new Date(),
      videoIds,
    });

    try {
      const videos = await InstagramVideo.find({
        _id: { $in: videoIds },
        status: 'downloaded',
        localPath: { $exists: true },
      });

      if (videos.length === 0) {
        throw new Error('Birleştirilecek indirilmiş video bulunamadı');
      }

      const mergedPath = await mergerService.mergeVideos(videos.map((v) => v.localPath));
      job.mergedVideoPath = mergedPath;

      const uploadResult = await youtubeService.uploadVideo(mergedPath, {
        ...options,
        jobId: job._id,
        sourceVideoCount: videos.length,
      });

      job.youtubeVideoId = uploadResult.videoId;
      job.youtubeUrl = uploadResult.youtubeUrl;
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();

      for (const video of videos) {
        video.status = 'uploaded';
        await video.save();
      }

      return { job, uploadResult };
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error.message;
      job.completedAt = new Date();
      await job.save();
      throw error;
    }
  }

  async getJobStatus(jobId) {
    return Job.findById(jobId).populate('videoIds');
  }

  async getRecentJobs(limit = 10) {
    return Job.find().sort({ createdAt: -1 }).limit(limit).populate('videoIds');
  }
}

export default new PipelineService();
