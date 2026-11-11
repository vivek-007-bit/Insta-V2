import mongoose from 'mongoose';

const followRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
      index: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate follow requests between the same pair
followRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema);

export default FollowRequest;
