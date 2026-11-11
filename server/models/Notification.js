import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification sender is required'],
      index: true
    },
    type: {
      type: String,
      enum: [
        'follow',
        'follow_request',
        'follow_request_accepted',
        'like',
        'comment',
        'reel_like',
        'reel_comment'
      ],
      required: [true, 'Notification type is required'],
      index: true
    },
    entityType: {
      type: String,
      enum: ['User', 'Post', 'Reel', 'Comment', 'FollowRequest'],
      required: [true, 'Entity type is required']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Entity ID is required']
    },
    message: {
      type: String,
      default: '',
      maxlength: [200, 'Notification message cannot exceed 200 characters']
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast paginated retrieval, unread counts, and deduplication
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, sender: 1, type: 1, entityId: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
