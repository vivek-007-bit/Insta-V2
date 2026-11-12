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
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        viewedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from creation
    }
  },
  {
    timestamps: true
  }
);

// MongoDB TTL index for automatic expiration cleanup
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for active stories feed queries
storySchema.index({ user: 1, expiresAt: 1, createdAt: 1 });

const Story = mongoose.model('Story', storySchema);

export default Story;
