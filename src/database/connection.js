import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB bağlantısı kuruldu');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB bağlantı hatası', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB bağlantısı kesildi');
  });

  await mongoose.connect(config.mongodbUri);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
