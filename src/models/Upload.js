import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    youtubeVideoId: { type: String, required: true, index: true },
    youtubeUrl: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    tags: [String],
    privacyStatus: { type: String, enum: ['private', 'unlisted', 'public'], default: 'private' },
    sourceVideoCount: { type: Number, default: 0 },
    mergedVideoPath: { type: String },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'completed', 'failed'],
      default: 'uploading',
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const Upload = mongoose.model('Upload', uploadSchema);
