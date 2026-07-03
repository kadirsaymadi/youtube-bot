import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { google } from 'googleapis';
import config from '../config/index.js';
import { Upload } from '../models/Upload.js';
import logger from '../utils/logger.js';

export class YouTubeService {
  constructor() {
    this.oauth2Client = null;
    this.youtube = null;
  }

  initialize() {
    const { clientId, clientSecret, redirectUri, refreshToken } = config.youtube;

    if (!clientId || !clientSecret) {
      throw new Error('YouTube OAuth2 kimlik bilgileri eksik (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET)');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    if (refreshToken) {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    }

    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    return this;
  }

  getAuthUrl() {
    if (!this.oauth2Client) this.initialize();

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'],
      prompt: 'consent',
    });
  }

  async exchangeCodeForTokens(code) {
    if (!this.oauth2Client) this.initialize();

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  async uploadVideo(videoPath, options = {}) {
    if (!this.youtube) this.initialize();

    const { refreshToken } = config.youtube;
    if (!refreshToken) {
      throw new Error('YouTube refresh token eksik. /auth/youtube endpoint\'ini kullanarak yetkilendirme yapın.');
    }

    const fileStats = await stat(videoPath);
    const title = options.title || config.youtube.defaultTitle;
    const description = options.description || config.youtube.defaultDescription;
    const tags = options.tags || config.youtube.defaultTags;
    const privacyStatus = options.privacyStatus || config.youtube.defaultPrivacy;
    const categoryId = options.categoryId || config.youtube.defaultCategoryId;

    const uploadRecord = await Upload.create({
      title,
      description,
      tags,
      privacyStatus,
      mergedVideoPath: videoPath,
      status: 'uploading',
      jobId: options.jobId,
      sourceVideoCount: options.sourceVideoCount || 0,
    });

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId,
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: createReadStream(videoPath),
        },
      });

      const videoId = response.data.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      uploadRecord.youtubeVideoId = videoId;
      uploadRecord.youtubeUrl = youtubeUrl;
      uploadRecord.status = 'completed';
      await uploadRecord.save();

      logger.info('Video YouTube\'a yüklendi', {
        videoId,
        youtubeUrl,
        fileSize: fileStats.size,
      });

      return {
        videoId,
        youtubeUrl,
        uploadRecord,
      };
    } catch (error) {
      uploadRecord.status = 'failed';
      uploadRecord.errorMessage = error.message;
      await uploadRecord.save();

      logger.error('YouTube yükleme hatası', { error: error.message });
      throw error;
    }
  }

  async getChannelInfo() {
    if (!this.youtube) this.initialize();

    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    });

    return response.data.items?.[0] || null;
  }
}

export default new YouTubeService();
