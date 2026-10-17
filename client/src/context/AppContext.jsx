import React, { createContext, useContext, useState, useEffect } from "react";
import {
  CURRENT_USER,
  INITIAL_POSTS,
  INITIAL_STORIES,
  SUGGESTED_USERS,
  INITIAL_CONVERSATIONS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REELS
} from "../data/demoData";

const AppContext = createContext();

export function AppProvider({ children }) {
  // Search Panel overlay state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Recent searches state
  const [recentSearches, setRecentSearches] = useState(() => [
    {
      id: "elena_designs",
      username: "elena_designs",
      fullName: "Elena Rostova",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      isVerified: true
    },
    {
      id: "alex_travels",
      username: "alex_travels",
      fullName: "Alex Rivera",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      isVerified: true
    }
  ]);

  const addRecentSearch = (user) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(u => u.username !== user.username);
      return [user, ...filtered].slice(0, 8);
    });
  };

  const removeRecentSearch = (username) => {
    setRecentSearches(prev => prev.filter(u => u.username !== username));
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
  };
  // Theme state: dark / light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("insta_v2_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("insta_v2_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  // Registered Demo Accounts List
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    const stored = localStorage.getItem("insta_v2_registered_users");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // ignore
      }
    }
    return [
      {
        id: CURRENT_USER.id,
        username: CURRENT_USER.username,
        email: "demo@insta-v2.com",
        fullName: CURRENT_USER.fullName,
        avatar: CURRENT_USER.avatar,
        bio: CURRENT_USER.bio,
        website: CURRENT_USER.website,
        postsCount: CURRENT_USER.postsCount,
        followersCount: CURRENT_USER.followersCount,
        followingCount: CURRENT_USER.followingCount,
        isVerified: CURRENT_USER.isVerified
      },
      {
        id: "user_elena",
        username: "elena_designs",
        email: "elena@example.com",
        fullName: "Elena Rostova",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        bio: "Visual designer & architect 🏛️",
        website: "https://elenarostova.design",
        postsCount: 8,
        followersCount: 840,
        followingCount: 220,
        isVerified: true
      }
    ];
  });

  // Auth Session state: defaults to true for initial visit, respects logout
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const session = localStorage.getItem("insta_v2_auth_session");
    if (session !== null) {
      return session === "true";
    }
    return true;
  });

  // User Profile state
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = localStorage.getItem("insta_v2_current_user");
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        // ignore
      }
    }
    return CURRENT_USER;
  });

  // Persist current user in local storage
  useEffect(() => {
    localStorage.setItem("insta_v2_current_user", JSON.stringify(currentUser));
  }, [currentUser]);

  // Persist registered users in local storage
  useEffect(() => {
    localStorage.setItem("insta_v2_registered_users", JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  // Sidebar Collapsed state (persisted across sessions)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("insta_v2_sidebar_collapsed") === "true";
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("insta_v2_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Posts State
  const [posts, setPosts] = useState(INITIAL_POSTS);

  // Saved Posts (derived or stored)
  const [savedPostIds, setSavedPostIds] = useState(() => new Set(["post_2"]));

  // Stories State
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null); // null or number

  // Suggested Users
  const [suggestedUsers, setSuggestedUsers] = useState(SUGGESTED_USERS);

  // Conversations (Messages)
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState("conv_1");

  // Notifications
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  // Create Post Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Create Story Modal State
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);

  // Active Post Detail Modal (for comments modal / post detail view)
  const [selectedPostDetail, setSelectedPostDetail] = useState(null);

  // Share Dialog state
  const [shareDialogPost, setShareDialogPost] = useState(null);

  // Post Options / More Menu dialog
  const [moreOptionsPost, setMoreOptionsPost] = useState(null);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Feedback Toast (e.g. "Link copied to clipboard", "Post reported")
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Toggle Like Post
  const toggleLikePost = (postId) => {
    setPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id === postId) {
          const willLike = !p.isLiked;
          return {
            ...p,
            isLiked: willLike,
            likesCount: willLike ? p.likesCount + 1 : p.likesCount - 1
          };
        }
        return p;
      })
    );

    // Also update selectedPostDetail if open
    setSelectedPostDetail(prev => {
      if (prev && prev.id === postId) {
        const willLike = !prev.isLiked;
        return {
          ...prev,
          isLiked: willLike,
          likesCount: willLike ? prev.likesCount + 1 : prev.likesCount - 1
        };
      }
      return prev;
    });
  };

  // Double Click Like Post (only like if not already liked)
  const doubleClickLikePost = (postId) => {
    setPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id === postId && !p.isLiked) {
          return {
            ...p,
            isLiked: true,
            likesCount: p.likesCount + 1
          };
        }
        return p;
      })
    );
    setSelectedPostDetail(prev => {
      if (prev && prev.id === postId && !prev.isLiked) {
        return {
          ...prev,
          isLiked: true,
          likesCount: prev.likesCount + 1
        };
      }
      return prev;
    });
  };

  // Toggle Save Post
  const toggleSavePost = (postId) => {
    setSavedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
        showToast("Removed from saved items");
      } else {
        next.add(postId);
        showToast("Saved to your collection");
      }
      return next;
    });

    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, isSaved: !p.isSaved } : p))
    );

    setSelectedPostDetail(prev => {
      if (prev && prev.id === postId) {
        return { ...prev, isSaved: !prev.isSaved };
      }
      return prev;
    });
  };

  // Add Comment
  const addComment = (postId, text) => {
    if (!text.trim()) return;
    const newComment = {
      id: "comm_" + Date.now(),
      username: currentUser.username,
      text: text.trim(),
      createdAt: "Just now",
      likesCount: 0,
      isLiked: false
    };

    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [...p.comments, newComment]
          };
        }
        return p;
      })
    );

    setSelectedPostDetail(prev => {
      if (prev && prev.id === postId) {
        return {
          ...prev,
          comments: [...prev.comments, newComment]
        };
      }
      return prev;
    });
  };

  // Add New Post
  const addNewPost = ({ mediaUrl, caption, location, mediaAspect = "square" }) => {
    const createdPost = {
      id: "post_" + Date.now(),
      author: {
        id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName,
        avatar: currentUser.avatar,
        isVerified: currentUser.isVerified
      },
      location: location || "San Francisco, CA",
      mediaUrl,
      mediaAspect,
      likesCount: 0,
      isLiked: false,
      isSaved: false,
      caption,
      createdAt: "JUST NOW",
      comments: []
    };

    setPosts(prev => [createdPost, ...prev]);
    setCurrentUser(prev => ({
      ...prev,
      postsCount: prev.postsCount + 1
    }));
    showToast("Post shared to feed!");
  };

  // Add New Story
  const addNewStory = ({ mediaUrl, mediaType = "image", caption = "" }) => {
    const newSlide = {
      id: "slide_" + Date.now(),
      mediaUrl,
      mediaType,
      timestamp: "Just now",
      caption: caption.trim() || undefined
    };

    setStories(prevStories => {
      const existingUserStoryIndex = prevStories.findIndex(
        s => s.userId === currentUser.id || s.username === currentUser.username
      );

      if (existingUserStoryIndex !== -1) {
        // Append to existing story for current user
        return prevStories.map((story, idx) => {
          if (idx === existingUserStoryIndex) {
            return {
              ...story,
              hasUnseen: true,
              stories: [...story.stories, newSlide]
            };
          }
          return story;
        });
      } else {
        // Prepend brand new story entry for current user
        const newStoryEntry = {
          id: "story_user_me",
          userId: currentUser.id,
          username: currentUser.username,
          userAvatar: currentUser.avatar,
          hasUnseen: true,
          stories: [newSlide]
        };
        return [newStoryEntry, ...prevStories];
      }
    });

    showToast("Added to your story!");
  };

  // Follow / Unfollow suggested user
  const toggleFollowUser = (userId) => {
    setSuggestedUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          const nextState = !u.isFollowing;
          setCurrentUser(curr => ({
            ...curr,
            followingCount: nextState ? curr.followingCount + 1 : curr.followingCount - 1
          }));
          return { ...u, isFollowing: nextState };
        }
        return u;
      })
    );
  };

  // Send message in active conversation
  const sendMessage = (convId, text) => {
    if (!text.trim()) return;
    const newMsg = {
      id: "msg_" + Date.now(),
      senderId: currentUser.id,
      text: text.trim(),
      timestamp: "Just now"
    };

    setConversations(prev =>
      prev.map(c => {
        if (c.id === convId) {
          return {
            ...c,
            messages: [...c.messages, newMsg]
          };
        }
        return c;
      })
    );
  };

  // Mark all notifications as read
  const markNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    showToast("All notifications marked as read");
  };

  // Update profile
  const updateProfile = ({ fullName, username, bio, website, avatar }) => {
    setCurrentUser(prev => ({
      ...prev,
      fullName: fullName !== undefined ? fullName : prev.fullName,
      username: username !== undefined ? username : prev.username,
      bio: bio !== undefined ? bio : prev.bio,
      website: website !== undefined ? website : prev.website,
      avatar: avatar !== undefined ? avatar : prev.avatar
    }));
    showToast("Profile updated successfully");
  };

  // Login handler
  const login = (identifier, password) => {
    const cleanId = (identifier || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    if (!cleanId || !cleanPass) {
      return {
        success: false,
        error: "Please enter your username or email and password."
      };
    }

    // Match against registered users or suggested users or current demo user
    let matched = registeredUsers.find(
      u => u.username.toLowerCase() === cleanId || (u.email && u.email.toLowerCase() === cleanId)
    );

    if (!matched && (cleanId === CURRENT_USER.username.toLowerCase() || cleanId === "demo@insta-v2.com")) {
      matched = CURRENT_USER;
    }

    if (!matched) {
      const sugMatch = SUGGESTED_USERS.find(u => u.username.toLowerCase() === cleanId);
      if (sugMatch) {
        matched = {
          id: sugMatch.id,
          username: sugMatch.username,
          fullName: sugMatch.fullName,
          avatar: sugMatch.avatar,
          bio: `Demo account for @${sugMatch.username}`,
          website: "",
          postsCount: 3,
          followersCount: 350,
          followingCount: 190,
          isVerified: false
        };
      }
    }

    if (!matched) {
      return {
        success: false,
        error: "Sorry, your username or password was incorrect. Please double-check your credentials."
      };
    }

    setCurrentUser(matched);
    setIsAuthenticated(true);
    localStorage.setItem("insta_v2_auth_session", "true");
    showToast(`Welcome back, @${matched.username}!`);
    return { success: true, user: matched };
  };

  // Sign up handler
  const signup = ({ fullName, username, email, password }) => {
    const cleanUser = (username || "").trim().toLowerCase();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanName = (fullName || "").trim();
    const cleanPass = (password || "").trim();

    if (!cleanUser || !cleanEmail || !cleanName || !cleanPass) {
      return { success: false, error: "Please fill out all required fields." };
    }

    if (cleanUser.length < 3) {
      return { success: false, error: "Username must be at least 3 characters long." };
    }

    if (!/^[a-z0-9_.]+$/.test(cleanUser)) {
      return { success: false, error: "Username can only contain letters, numbers, underscores and periods." };
    }

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return { success: false, error: "Please enter a valid email address." };
    }

    if (cleanPass.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    // Check duplicate username or email
    const existsUser = registeredUsers.some(u => u.username.toLowerCase() === cleanUser);
    if (existsUser) {
      return { success: false, error: "This username isn't available. Please choose another." };
    }

    const existsEmail = registeredUsers.some(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (existsEmail) {
      return { success: false, error: "An account with this email address already exists." };
    }

    const newUser = {
      id: "user_" + Date.now(),
      username: cleanUser,
      fullName: cleanName,
      email: cleanEmail,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      bio: "Exploring Insta-V2 social demo ✨",
      website: "",
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      isVerified: false
    };

    setRegisteredUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem("insta_v2_auth_session", "true");
    showToast(`Welcome to Insta-V2, @${newUser.username}!`);
    return { success: true, user: newUser };
  };

  // Quick Demo Login helper
  const quickDemoLogin = (username = "insta_creator") => {
    let matched = registeredUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!matched) {
      matched = CURRENT_USER;
    }
    setCurrentUser(matched);
    setIsAuthenticated(true);
    localStorage.setItem("insta_v2_auth_session", "true");
    showToast(`Logged in as @${matched.username}`);
    return { success: true, user: matched };
  };

  // Logout handler
  const logout = () => {
    setIsAuthenticated(false);
    localStorage.setItem("insta_v2_auth_session", "false");
    showToast("Logged out of Insta-V2 demo");
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        updateProfile,
        isAuthenticated,
        registeredUsers,
        login,
        signup,
        logout,
        quickDemoLogin,
        posts,
        savedPostIds,
        stories,
        setStories,
        activeStoryIndex,
        setActiveStoryIndex,
        suggestedUsers,
        conversations,
        activeConvId,
        setActiveConvId,
        sendMessage,
        notifications,
        markNotificationsAsRead,
        isCreateModalOpen,
        setIsCreateModalOpen,
        isCreateStoryOpen,
        setIsCreateStoryOpen,
        addNewStory,
        selectedPostDetail,
        setSelectedPostDetail,
        shareDialogPost,
        setShareDialogPost,
        moreOptionsPost,
        setMoreOptionsPost,
        isEditProfileOpen,
        setIsEditProfileOpen,
        isSearchOpen,
        setIsSearchOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebarCollapse,
        recentSearches,
        addRecentSearch,
        removeRecentSearch,
        clearAllRecentSearches,
        toggleLikePost,
        doubleClickLikePost,
        toggleSavePost,
        addComment,
        addNewPost,
        toggleFollowUser,
        toastMessage,
        showToast,
        initialReels: INITIAL_REELS
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
