import mongoose from 'mongoose';

const reelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reel must belong to a user'],
      index: true
    },
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true
    },
    publicId: {
      type: String,
      required: [true, 'Cloudinary public ID is required'],
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true
    },
    caption: {
      type: String,
      default: '',
      maxlength: [2200, 'Caption cannot exceed 2200 characters']
    },
    audioTrack: {
      type: String,
      default: '',
      maxlength: [120, 'Audio track name cannot exceed 120 characters']
    },
    duration: {
      type: Number,
      default: 0,
      min: 0
    },
    aspectRatio: {
      type: String,
      default: '9:16'
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    sharesCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

reelSchema.index({ createdAt: -1 });
reelSchema.index({ user: 1, createdAt: -1 });

const Reel = mongoose.model('Reel', reelSchema);

export default Reel;
