import mongoose from 'mongoose';

const instagramVideoSchema = new mongoose.Schema(
  {
    sourceUrl: { type: String, required: true },
    sourceType: { type: String, enum: ['profile', 'post', 'reel'], default: 'post' },
    instagramId: { type: String, index: true },
    title: { type: String },
    description: { type: String },
    localPath: { type: String },
    thumbnailUrl: { type: String },
    duration: { type: Number },
    fileSize: { type: Number },
    status: {
      type: String,
      enum: ['pending', 'downloading', 'downloaded', 'failed', 'merged', 'uploaded'],
      default: 'pending',
      index: true,
    },
    errorMessage: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

instagramVideoSchema.index({ sourceUrl: 1, instagramId: 1 }, { unique: true, sparse: true });

export const InstagramVideo = mongoose.model('InstagramVideo', instagramVideoSchema);
