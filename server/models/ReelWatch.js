import mongoose from 'mongoose';

const reelWatchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
      required: true,
      index: true
    },
    watchDurationSec: {
      type: Number,
      default: 0,
      min: 0
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

reelWatchSchema.index({ user: 1, reel: 1 }, { unique: true });
reelWatchSchema.index({ user: 1, lastWatchedAt: -1 });

const ReelWatch = mongoose.model('ReelWatch', reelWatchSchema);

export default ReelWatch;
