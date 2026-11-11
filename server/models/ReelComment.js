import mongoose from 'mongoose';

const reelCommentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment author is required'],
      index: true
    },
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
      required: [true, 'Reel reference is required'],
      index: true
    },
    text: {
      type: String,
      required: [true, 'Comment text cannot be empty'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    }
  },
  {
    timestamps: true
  }
);

reelCommentSchema.index({ reel: 1, createdAt: -1 });

const ReelComment = mongoose.model('ReelComment', reelCommentSchema);

export default ReelComment;
