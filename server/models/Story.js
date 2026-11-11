import mongoose from 'mongoose';

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Story must belong to a user'],
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
      maxlength: [150, 'Story caption cannot exceed 150 characters']
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from creation
      index: { expires: 0 } // MongoDB TTL index to auto-remove expired documents
    }
  },
  {
    timestamps: true
  }
);

const Story = mongoose.model('Story', storySchema);

export default Story;
