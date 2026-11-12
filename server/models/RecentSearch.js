import mongoose from 'mongoose';

const recentSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['user', 'hashtag', 'place', 'query'],
      required: true
    },
    dedupeKey: {
      type: String,
      required: true
    },
    query: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    hashtag: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    location: {
      type: String,
      default: '',
      trim: true
    },
    searchedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

recentSearchSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
recentSearchSchema.index({ user: 1, searchedAt: -1 });

const RecentSearch = mongoose.model('RecentSearch', recentSearchSchema);

export default RecentSearch;
