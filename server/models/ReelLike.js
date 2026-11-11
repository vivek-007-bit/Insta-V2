import mongoose from 'mongoose';

const reelLikeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true
    },
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
      required: [true, 'Reel is required'],
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

// Prevent duplicate likes by the same user on the same reel
reelLikeSchema.index({ user: 1, reel: 1 }, { unique: true });

const ReelLike = mongoose.model('ReelLike', reelLikeSchema);

export default ReelLike;
