import { writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { ensureDir, runCommand, getTimestamp } from '../utils/helpers.js';

export class VideoMergerService {
  constructor(mergedDir = config.mergedDir) {
    this.mergedDir = mergedDir;
  }

  async fileExists(filePath) {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async mergeVideos(videoPaths, outputFilename = null) {
    const validPaths = [];

    for (const p of videoPaths) {
      if (await this.fileExists(p)) {
        validPaths.push(p);
      } else {
        logger.warn('Birleştirme için dosya bulunamadı, atlanıyor', { path: p });
      }
    }

    if (validPaths.length === 0) {
      throw new Error('Birleştirilecek geçerli video bulunamadı');
    }

    await ensureDir(this.mergedDir);

    const outputName = outputFilename || `merged_${getTimestamp()}.mp4`;
    const outputPath = path.join(this.mergedDir, outputName);

    if (validPaths.length === 1) {
      logger.info('Tek video, doğrudan kopyalanıyor', { path: validPaths[0] });
      await runCommand('ffmpeg', [
        '-y',
        '-i',
        validPaths[0],
        '-c',
        'copy',
        outputPath,
      ]);
      return outputPath;
    }

    const listFilePath = path.join(this.mergedDir, `filelist_${getTimestamp()}.txt`);
    const listContent = validPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(listFilePath, listContent);

    try {
      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFilePath,
        '-c',
        'copy',
        outputPath,
      ]);

      logger.info('Videolar birleştirildi', {
        count: validPaths.length,
        outputPath,
      });

      return outputPath;
    } catch (error) {
      logger.warn('Concat copy başarısız, re-encode deneniyor', { error: error.message });

      await runCommand('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFilePath,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputPath,
      ]);

      logger.info('Videolar re-encode ile birleştirildi', { outputPath });
      return outputPath;
    } finally {
      try {
        await unlink(listFilePath);
      } catch {
        // geçici dosya temizliği
      }
    }
  }

  async mergeWithTransitions(videoPaths, outputFilename = null) {
    const validPaths = [];
    for (const p of videoPaths) {
      if (await this.fileExists(p)) validPaths.push(p);
    }

    if (validPaths.length <= 1) {
      return this.mergeVideos(videoPaths, outputFilename);
    }

    await ensureDir(this.mergedDir);
    const outputName = outputFilename || `merged_transition_${getTimestamp()}.mp4`;
    const outputPath = path.join(this.mergedDir, outputName);

    let filterComplex = '';
    let inputs = [];

    for (let i = 0; i < validPaths.length; i++) {
      inputs.push('-i', validPaths[i]);
    }

    if (validPaths.length === 2) {
      filterComplex = '[0:v][1:v]concat=n=2:v=1:a=0[outv];[0:a][1:a]concat=n=2:v=0:a=1[outa]';
    } else {
      const vInputs = validPaths.map((_, i) => `[${i}:v]`).join('');
      const aInputs = validPaths.map((_, i) => `[${i}:a]`).join('');
      filterComplex = `${vInputs}concat=n=${validPaths.length}:v=1:a=0[outv];${aInputs}concat=n=${validPaths.length}:v=0:a=1[outa]`;
    }

    await runCommand('ffmpeg', [
      '-y',
      ...inputs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      outputPath,
    ]);

    return outputPath;
  }
}

export default new VideoMergerService();
