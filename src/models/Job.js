import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['download', 'merge', 'upload', 'full_pipeline'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    videoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InstagramVideo' }],
    mergedVideoPath: { type: String },
    youtubeVideoId: { type: String },
    youtubeUrl: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    errorMessage: { type: String },
    logs: [{ message: String, timestamp: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

export const Job = mongoose.model('Job', jobSchema);
