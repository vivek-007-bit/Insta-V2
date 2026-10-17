export const CURRENT_USER = {
  id: "user_me",
  username: "insta_creator",
  fullName: "Insta-V2 Official Demo",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  bio: "Exploring the next evolution of social UI ✨\n📸 Photography | 💻 Tech | 🎨 Minimal Design\n📍 San Francisco, CA\nlinktr.ee/instav2",
  website: "https://insta-v2.demo",
  postsCount: 12,
  followersCount: 1420,
  followingCount: 388,
  isVerified: true
};

export const INITIAL_STORIES = [
  {
    id: "story_1",
    userId: "elena_designs",
    username: "elena_designs",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    hasUnseen: true,
    stories: [
      {
        id: "s1_1",
        mediaUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
        timestamp: "2h ago",
        caption: "Golden hour waves 🌊✨"
      },
      {
        id: "s1_2",
        mediaUrl: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop&q=80",
        timestamp: "1h ago",
        caption: "Beachside coffee stop ☕"
      }
    ]
  },
  {
    id: "story_2",
    userId: "alex_travels",
    username: "alex_travels",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    hasUnseen: true,
    stories: [
      {
        id: "s2_1",
        mediaUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80",
        timestamp: "4h ago",
        caption: "Crossing mountain passes in the Alps 🏔️"
      }
    ]
  },
  {
    id: "story_3",
    userId: "sophia_art",
    username: "sophia_art",
    userAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    hasUnseen: true,
    stories: [
      {
        id: "s3_1",
        mediaUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80",
        timestamp: "5h ago",
        caption: "Oil on canvas in progress 🎨"
      }
    ]
  },
  {
    id: "story_4",
    userId: "marcus_code",
    username: "marcus_code",
    userAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    hasUnseen: false,
    stories: [
      {
        id: "s4_1",
        mediaUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80",
        timestamp: "8h ago",
        caption: "Late night coding session setup 💻⚡"
      }
    ]
  },
  {
    id: "story_5",
    userId: "nora_coffee",
    username: "nora_coffee",
    userAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    hasUnseen: false,
    stories: [
      {
        id: "s5_1",
        mediaUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80",
        timestamp: "12h ago",
        caption: "Morning roast smell is unmatched ☕🌿"
      }
    ]
  },
  {
    id: "story_6",
    userId: "liam_urban",
    username: "liam_urban",
    userAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    hasUnseen: true,
    stories: [
      {
        id: "s6_1",
        mediaUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
        timestamp: "3h ago",
        caption: "Metropolis reflections from 42 floors up 🏙️"
      }
    ]
  }
];

export const INITIAL_POSTS = [
  {
    id: "post_1",
    author: {
      id: "elena_designs",
      username: "elena_designs",
      fullName: "Elena Rostova",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isVerified: true
    },
    location: "Kyoto, Japan",
    mediaUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1080&auto=format&fit=crop&q=80",
    mediaAspect: "portrait", // portrait 4:5
    likesCount: 1248,
    isLiked: false,
    isSaved: false,
    caption: "Quiet mornings in the bamboo groves of Arashiyama. The light filtration through the mist here is simply magical. 🎋🇯🇵 #kyoto #japan #travelphotography #wanderlust",
    createdAt: "2 HOURS AGO",
    comments: [
      {
        id: "c1",
        username: "alex_travels",
        text: "The serenity in this shot is unreal Elena! What lens did you use?",
        createdAt: "1h ago",
        likesCount: 14,
        isLiked: false
      },
      {
        id: "c2",
        username: "sophia_art",
        text: "The green tonality here is so soothing ✨",
        createdAt: "45m ago",
        likesCount: 4,
        isLiked: false
      }
    ]
  },
  {
    id: "post_2",
    author: {
      id: "marcus_code",
      username: "marcus_code",
      fullName: "Marcus Vance",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      isVerified: false
    },
    location: "Seattle, WA",
    mediaUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1080&auto=format&fit=crop&q=80",
    mediaAspect: "landscape", // landscape 16:9
    likesCount: 894,
    isLiked: false,
    isSaved: true,
    caption: "Clean desk, clear mind. Dialing in the final UI components for Insta-V2! Pure custom CSS feels remarkably liberating. 🚀💻",
    createdAt: "5 HOURS AGO",
    comments: [
      {
        id: "c3",
        username: "nora_coffee",
        text: "Need that keyboard! What switches are on it?",
        createdAt: "3h ago",
        likesCount: 2,
        isLiked: false
      }
    ]
  },
  {
    id: "post_3",
    author: {
      id: "alex_travels",
      username: "alex_travels",
      fullName: "Alex Rivera",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isVerified: true
    },
    location: "Dolomites, Italy",
    mediaUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&auto=format&fit=crop&q=80",
    mediaAspect: "square", // square 1:1
    likesCount: 3410,
    isLiked: true,
    isSaved: false,
    caption: "Alpenglow hitting the Tre Cime peaks right as twilight arrived. 3-hour hike up with 20kg of camera gear was totally worth it. 🏔️🎒",
    createdAt: "9 HOURS AGO",
    comments: [
      {
        id: "c4",
        username: "elena_designs",
        text: "Incredible depth Alex! Stunning capture 👏",
        createdAt: "8h ago",
        likesCount: 18,
        isLiked: true
      },
      {
        id: "c5",
        username: "liam_urban",
        text: "Epic scale! Added to my bucket list.",
        createdAt: "7h ago",
        likesCount: 6,
        isLiked: false
      }
    ]
  },
  {
    id: "post_4",
    author: {
      id: "sophia_art",
      username: "sophia_art",
      fullName: "Sophia Chen",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      isVerified: false
    },
    location: "Studio 4B, New York",
    mediaUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1080&auto=format&fit=crop&q=80",
    mediaAspect: "portrait",
    likesCount: 567,
    isLiked: false,
    isSaved: false,
    caption: "Texture studies from today's oil glaze application. Layers upon layers until the light bounces just right. 🎨🖌️",
    createdAt: "1 DAY AGO",
    comments: []
  }
];

export const SUGGESTED_USERS = [
  {
    id: "sug_1",
    username: "clara_lens",
    fullName: "Clara M. Oswald",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    subtitle: "Followed by alex_travels + 3 more",
    isFollowing: false
  },
  {
    id: "sug_2",
    username: "nordic_spaces",
    fullName: "Nordic Living & Arch",
    avatar: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=150&auto=format&fit=crop&q=80",
    subtitle: "Suggested for you",
    isFollowing: false
  },
  {
    id: "sug_3",
    username: "david_sound",
    fullName: "David K. Audio",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    subtitle: "New to Insta-V2",
    isFollowing: false
  },
  {
    id: "sug_4",
    username: "maya_culinary",
    fullName: "Chef Maya Lin",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80",
    subtitle: "Follows you",
    isFollowing: false
  },
  {
    id: "sug_5",
    username: "kai_visuals",
    fullName: "Kai Tanaka 3D",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    subtitle: "Followed by elena_designs",
    isFollowing: false
  }
];


export const INITIAL_REELS = [
  {
    id: "reel_1",
    author: {
      username: "nature_moments",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      isVerified: true
    },
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4",
    posterUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    caption: "Crystal clear ocean swell sound ✨🌊 Turn sound on!",
    audioTrack: "nature_moments • Original Audio - Ocean Breeze",
    likesCount: 24500,
    commentsCount: 890,
    sharesCount: 1420,
    isLiked: false,
    isSaved: false
  },
  {
    id: "reel_2",
    author: {
      username: "urban_skate",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      isVerified: false
    },
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-tree-branches-in-the-breeze-1188-large.mp4",
    posterUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
    caption: "Wind blowing through the autumn canopy 🍂 Serenity in the city park.",
    audioTrack: "Chill Beats • Autumn Vibes Vol. 1",
    likesCount: 18200,
    commentsCount: 421,
    sharesCount: 930,
    isLiked: true,
    isSaved: true
  }
];

export const INITIAL_CONVERSATIONS = [
  {
    id: "conv_1",
    user: {
      id: "elena_designs",
      username: "elena_designs",
      fullName: "Elena Rostova",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isOnline: true
    },
    unreadCount: 1,
    messages: [
      {
        id: "m1",
        senderId: "elena_designs",
        text: "Hey! Loved the new post about Kyoto, have you visited the northern temples yet?",
        timestamp: "10:14 AM"
      },
      {
        id: "m2",
        senderId: "user_me",
        text: "Hey Elena! Yes, visited Kinkaku-ji yesterday. The golden reflection on the pond was unreal!",
        timestamp: "10:18 AM"
      },
      {
        id: "m3",
        senderId: "elena_designs",
        text: "Awesome! Let me know if you want the list of hidden coffee spots there ☕",
        timestamp: "10:25 AM"
      }
    ]
  },
  {
    id: "conv_2",
    user: {
      id: "alex_travels",
      username: "alex_travels",
      fullName: "Alex Rivera",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isOnline: false
    },
    unreadCount: 0,
    messages: [
      {
        id: "m4",
        senderId: "alex_travels",
        text: "Are you free for a quick photo walk this weekend?",
        timestamp: "Yesterday"
      },
      {
        id: "m5",
        senderId: "user_me",
        text: "Definitely! Sunday morning works great. Golden hour around the pier?",
        timestamp: "Yesterday"
      }
    ]
  },
  {
    id: "conv_3",
    user: {
      id: "sophia_art",
      username: "sophia_art",
      fullName: "Sophia Chen",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      isOnline: true
    },
    unreadCount: 0,
    messages: [
      {
        id: "m6",
        senderId: "sophia_art",
        text: "Shared your post with my art class group!",
        timestamp: "2d ago"
      }
    ]
  }
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: "notif_1",
    type: "like",
    user: {
      username: "elena_designs",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
    },
    text: "liked your post.",
    targetThumbnail: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=150&auto=format&fit=crop&q=80",
    timestamp: "15m",
    isRead: false
  },
  {
    id: "notif_2",
    type: "comment",
    user: {
      username: "alex_travels",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    },
    text: "commented: 'The serenity in this shot is unreal!'",
    targetThumbnail: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=150&auto=format&fit=crop&q=80",
    timestamp: "1h",
    isRead: false
  },
  {
    id: "notif_3",
    type: "follow",
    user: {
      username: "clara_lens",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    },
    text: "started following you.",
    timestamp: "3h",
    isRead: true
  },
  {
    id: "notif_4",
    type: "mention",
    user: {
      username: "sophia_art",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
    },
    text: "mentioned you in a comment: '@insta_creator check this out'",
    targetThumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150&auto=format&fit=crop&q=80",
    timestamp: "1d",
    isRead: true
  }
];
