import config from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { createApp } from './api/routes.js';
import { startScheduler, stopScheduler } from './workers/scheduler.js';
import { ensureDir } from './utils/helpers.js';
import logger from './utils/logger.js';

async function bootstrap() {
  try {
    await ensureDir(config.downloadDir);
    await ensureDir(config.mergedDir);
    await ensureDir('logs');

    await connectDatabase();

    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info(`Sunucu başlatıldı`, { port: config.port, env: config.nodeEnv });
    });

    startScheduler();

    const shutdown = async (signal) => {
      logger.info(`${signal} alındı, kapatılıyor...`);
      stopScheduler();
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Uygulama başlatılamadı', { error: error.message });
    process.exit(1);
  }
}

bootstrap();
