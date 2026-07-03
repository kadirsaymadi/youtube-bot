import express from 'express';
import config from '../config/index.js';
import pipelineService from '../services/pipeline.js';
import youtubeService from '../services/youtube.js';
import { InstagramVideo } from '../models/InstagramVideo.js';
import { Job } from '../models/Job.js';
import { Upload } from '../models/Upload.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/pipeline/run', async (req, res) => {
  try {
    const { sources, limitPerSource, title, description, tags, privacyStatus } = req.body;

    const result = await pipelineService.runFullPipeline({
      sources: sources || config.instagramSources,
      limitPerSource: limitPerSource || 5,
      title,
      description,
      tags,
      privacyStatus,
    });

    res.json({
      success: true,
      message: 'Pipeline başarıyla tamamlandı',
      data: {
        jobId: result.job._id,
        downloadedCount: result.downloadedCount,
        mergedPath: result.mergedPath,
        youtubeUrl: result.youtubeUrl,
        youtubeVideoId: result.youtubeVideoId,
      },
    });
  } catch (error) {
    logger.error('Pipeline API hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/download', async (req, res) => {
  try {
    const { sources, limitPerSource } = req.body;
    const result = await pipelineService.runDownloadOnly(
      sources || config.instagramSources,
      limitPerSource || 5
    );

    res.json({
      success: true,
      message: `${result.videos.length} video indirildi`,
      data: { jobId: result.job._id, videos: result.videos },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/upload', async (req, res) => {
  try {
    const { videoIds, title, description, tags, privacyStatus } = req.body;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ success: false, error: 'videoIds dizisi gerekli' });
    }

    const result = await pipelineService.runMergeAndUpload(videoIds, {
      title,
      description,
      tags,
      privacyStatus,
    });

    res.json({
      success: true,
      message: 'Video yüklendi',
      data: {
        jobId: result.job._id,
        youtubeUrl: result.job.youtubeUrl,
        youtubeVideoId: result.job.youtubeVideoId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const jobs = await pipelineService.getRecentJobs(limit);
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await pipelineService.getJobStatus(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'İş bulunamadı' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/videos', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = status ? { status } : {};
    const videos = await InstagramVideo.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));
    res.json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/uploads', async (req, res) => {
  try {
    const uploads = await Upload.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: uploads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/auth/youtube', (_req, res) => {
  try {
    const authUrl = youtubeService.getAuthUrl();
    res.json({
      success: true,
      message: 'Bu URL\'yi tarayıcıda açın ve yetkilendirme kodunu alın',
      authUrl,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/auth/youtube/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Yetkilendirme kodu eksik' });
    }

    const tokens = await youtubeService.exchangeCodeForTokens(code);

    res.json({
      success: true,
      message: 'Yetkilendirme başarılı. refresh_token değerini .env dosyasına YOUTUBE_REFRESH_TOKEN olarak ekleyin.',
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/youtube/channel', async (_req, res) => {
  try {
    const channel = await youtubeService.getChannelInfo();
    res.json({ success: true, data: channel });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

export default router;
