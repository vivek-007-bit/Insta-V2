import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        }
      ],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'A direct conversation must have exactly 2 participants'
      }
    },
    // Canonical sorted key "<minUserId>:<maxUserId>" guarantees one unique thread per pair
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const buildConversationPairKey = (userIdA, userIdB) => {
  return [userIdA.toString(), userIdB.toString()].sort().join(':');
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
