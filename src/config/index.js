import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/youtube-bot',
  cronSchedule: process.env.CRON_SCHEDULE || '0 */6 * * *',
  downloadDir: process.env.DOWNLOAD_DIR || './downloads',
  mergedDir: process.env.MERGED_DIR || './merged',
  logLevel: process.env.LOG_LEVEL || 'info',
  instagramSources: (process.env.INSTAGRAM_SOURCES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
    defaultTitle: process.env.YOUTUBE_DEFAULT_TITLE || 'Instagram Video Derlemesi',
    defaultDescription: process.env.YOUTUBE_DEFAULT_DESCRIPTION || '',
    defaultTags: (process.env.YOUTUBE_DEFAULT_TAGS || 'instagram,compilation')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    defaultPrivacy: process.env.YOUTUBE_DEFAULT_PRIVACY || 'private',
    defaultCategoryId: process.env.YOUTUBE_DEFAULT_CATEGORY_ID || '22',
  },
};

export default config;
