import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post must belong to a user'],
      index: true
    },
    mediaUrl: {
      type: String,
      required: [true, 'Media URL is required'],
      trim: true
    },
    publicId: {
      type: String,
      required: [true, 'Cloudinary public ID is required'],
      trim: true
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    },
    caption: {
      type: String,
      default: '',
      maxlength: [2200, 'Caption cannot exceed 2200 characters']
    },
    location: {
      type: String,
      default: ''
    },
    mediaAspect: {
      type: String,
      enum: ['square', 'portrait', 'landscape'],
      default: 'square'
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
    }
  },
  {
    timestamps: true
  }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ location: 1 });

const Post = mongoose.model('Post', postSchema);

export default Post;
