import cron from 'node-cron';
import config from '../config/index.js';
import pipelineService from '../services/pipeline.js';
import instagramService from '../services/instagram.js';
import logger from '../utils/logger.js';

let scheduledTask = null;

export function startScheduler() {
  if (!cron.validate(config.cronSchedule)) {
    logger.error('Geçersiz cron ifadesi', { schedule: config.cronSchedule });
    return;
  }

  if (config.instagramSources.length === 0) {
    logger.warn('INSTAGRAM_SOURCES tanımlı değil, zamanlayıcı pasif');
    return;
  }

  scheduledTask = cron.schedule(config.cronSchedule, async () => {
    logger.info('Zamanlanmış pipeline çalıştırılıyor');

    try {
      await pipelineService.runFullPipeline();
      await instagramService.cleanupDownloaded(7);
    } catch (error) {
      logger.error('Zamanlanmış pipeline hatası', { error: error.message });
    }
  });

  logger.info('Zamanlayıcı başlatıldı', { schedule: config.cronSchedule });
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Zamanlayıcı durduruldu');
  }
}
