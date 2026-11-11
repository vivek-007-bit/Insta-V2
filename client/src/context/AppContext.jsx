import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import authService from "../services/authService";
import postService from "../services/postService";
import userService from "../services/userService";
import followRequestService from "../services/followRequestService";
import notificationService from "../services/notificationService";
import {
  INITIAL_STORIES,
  INITIAL_CONVERSATIONS,
  INITIAL_REELS
} from "../data/demoData";

const AppContext = createContext();

export function AppProvider({ children }) {
  // Search Panel overlay state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Recent searches state
  const [recentSearches, setRecentSearches] = useState([]);

  const addRecentSearch = (user) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((u) => u.username !== user.username);
      return [user, ...filtered].slice(0, 8);
    });
  };

  const removeRecentSearch = (username) => {
    setRecentSearches((prev) => prev.filter((u) => u.username !== username));
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
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Real Backend Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticationLoading, setAuthenticationLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Social States
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState(() => new Set());
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);

  // Conversations & Real Backend Notifications
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState("conv_1");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsHasMore, setNotificationsHasMore] = useState(false);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [notificationsError, setNotificationsError] = useState("");
  const socketRef = useRef(null);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [selectedPostDetail, setSelectedPostDetail] = useState(null);
  const [shareDialogPost, setShareDialogPost] = useState(null);
  const [moreOptionsPost, setMoreOptionsPost] = useState(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // Load feed posts from MongoDB
  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await postService.getFeedPosts(1, 30);
      if (res && Array.isArray(res.posts)) {
        setPosts(res.posts);
      }
    } catch (err) {
      console.error("[Feed] Error fetching posts:", err.message);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  // Load suggested users from MongoDB
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await userService.getSuggestedUsers(10);
      if (res && Array.isArray(res.users)) {
        setSuggestedUsers(res.users);
      }
    } catch (err) {
      console.error("[Users] Error fetching suggestions:", err.message);
    }
  }, []);

  // Load incoming follow requests
  const fetchFollowRequests = useCallback(async () => {
    try {
      const res = await followRequestService.getIncomingRequests();
      if (res && Array.isArray(res.requests)) {
        setFollowRequests(res.requests);
      }
    } catch (err) {
      console.error("[FollowRequests] Error fetching requests:", err.message);
    }
  }, []);

  // Load notifications from MongoDB
  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const res = await notificationService.getNotifications(pageNum, 20);
      if (res && Array.isArray(res.notifications)) {
        setNotifications((prev) => {
          if (!append) return res.notifications;
          const existingIds = new Set(prev.map((n) => n.id));
          const uniqueNext = res.notifications.filter((n) => !existingIds.has(n.id));
          return [...prev, ...uniqueNext];
        });
        setNotificationsHasMore(Boolean(res.hasMore));
        setNotificationsPage(pageNum);
        if (typeof res.unreadCount === "number") {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      setNotificationsError(err.message || "Failed to load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // Load unread count efficiently
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      if (res && typeof res.unreadCount === "number") {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error("[Notifications] Error fetching unread count:", err.message);
    }
  }, []);

  // Fetch current authenticated user session on mount
  const fetchCurrentUser = useCallback(async () => {
    setAuthenticationLoading(true);
    try {
      const res = await authService.getMe();
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setAuthenticationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Fetch social data & connect real-time Socket.IO when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setPosts([]);
      setSuggestedUsers([]);
      setFollowRequests([]);
      setNotifications([]);
      setUnreadCount(0);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    fetchFeed();
    fetchSuggestions();
    fetchFollowRequests();
    fetchNotifications(1, false);

    // Derive Socket.IO server origin from VITE_API_BASE_URL
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
    const socketOrigin = apiBase.replace(/\/api\/?$/, "");

    const socket = io(socketOrigin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on("new_notification", (newNotif) => {
      if (!newNotif) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      if (newNotif.type === "follow_request") {
        fetchFollowRequests();
      }
    });

    socket.on("unread_count_updated", (payload) => {
      if (payload && typeof payload.unreadCount === "number") {
        setUnreadCount(payload.unreadCount);
      }
    });

    // Polling fallback when Socket.IO is disconnected (e.g. serverless environments)
    const fallbackPollInterval = setInterval(() => {
      if (!socketRef.current?.connected) {
        fetchUnreadCount();
      }
    }, 30000);

    return () => {
      clearInterval(fallbackPollInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    isAuthenticated,
    fetchFeed,
    fetchSuggestions,
    fetchFollowRequests,
    fetchNotifications,
    fetchUnreadCount
  ]);

  // Real Backend Login
  const login = async (identifier, password) => {
    try {
      const res = await authService.login({ identifier, password });
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        showToast(res.message || `Welcome back, @${res.user.username}!`);
        return { success: true, user: res.user };
      }
      return { success: false, error: "Failed to authenticate" };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Invalid credentials"
      };
    }
  };

  // Real Backend Signup
  const signup = async ({ fullName, username, email, password }) => {
    try {
      const res = await authService.signup({
        fullName,
        username,
        email,
        password
      });
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        showToast(res.message || `Welcome to Insta-V2, @${res.user.username}!`);
        return { success: true, user: res.user };
      }
      return { success: false, error: "Failed to create account" };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Could not register account"
      };
    }
  };

  // Real Backend Logout
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error("[Auth] Logout error:", err);
    } finally {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setCurrentUser(null);
      setIsAuthenticated(false);
      setPosts([]);
      setSuggestedUsers([]);
      setFollowRequests([]);
      setNotifications([]);
      setUnreadCount(0);
      showToast("Logged out successfully");
    }
  };

  // Sidebar Collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("insta_v2_sidebar_collapsed") === "true";
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("insta_v2_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Optimistic Like / Unlike Post with rollback on API failure
  const toggleLikePost = async (postId) => {
    const targetPost =
      posts.find((p) => p.id === postId) ||
      (selectedPostDetail?.id === postId ? selectedPostDetail : null);

    if (!targetPost) return;

    const wasLiked = Boolean(targetPost.isLiked);
    const prevLikesCount = targetPost.likesCount || 0;
    const optimisticLiked = !wasLiked;
    const optimisticCount = optimisticLiked
      ? prevLikesCount + 1
      : Math.max(0, prevLikesCount - 1);

    const applyLikeState = (liked, count) => {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId ? { ...p, isLiked: liked, likesCount: count } : p
        )
      );
      setSelectedPostDetail((prev) =>
        prev && prev.id === postId
          ? { ...prev, isLiked: liked, likesCount: count }
          : prev
      );
    };

    // Optimistic update
    applyLikeState(optimisticLiked, optimisticCount);

    try {
      const res = optimisticLiked
        ? await postService.likePost(postId)
        : await postService.unlikePost(postId);

      // Sync with server count
      if (res && typeof res.likesCount === "number") {
        applyLikeState(res.liked, res.likesCount);
      }
    } catch (err) {
      // Roll back on failure
      applyLikeState(wasLiked, prevLikesCount);
      showToast(err.message || "Failed to update like");
    }
  };

  // Double Click Like Post (likes only if not already liked)
  const doubleClickLikePost = async (postId) => {
    const targetPost =
      posts.find((p) => p.id === postId) ||
      (selectedPostDetail?.id === postId ? selectedPostDetail : null);

    if (!targetPost || targetPost.isLiked) return;

    const prevLikesCount = targetPost.likesCount || 0;
    const applyLikeState = (liked, count) => {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId ? { ...p, isLiked: liked, likesCount: count } : p
        )
      );
      setSelectedPostDetail((prev) =>
        prev && prev.id === postId
          ? { ...prev, isLiked: liked, likesCount: count }
          : prev
      );
    };

    applyLikeState(true, prevLikesCount + 1);

    try {
      const res = await postService.likePost(postId);
      if (res && typeof res.likesCount === "number") {
        applyLikeState(true, res.likesCount);
      }
    } catch (err) {
      applyLikeState(false, prevLikesCount);
      showToast(err.message || "Failed to like post");
    }
  };

  // Toggle Save Post (client-side bookmark collection)
  const toggleSavePost = (postId) => {
    setSavedPostIds((prev) => {
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

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isSaved: !p.isSaved } : p))
    );

    setSelectedPostDetail((prev) =>
      prev && prev.id === postId ? { ...prev, isSaved: !prev.isSaved } : prev
    );
  };

  // Add Comment via backend API
  const addComment = async (postId, text) => {
    if (!text.trim() || !currentUser) return null;

    try {
      const res = await postService.addComment(postId, text.trim());
      const newComment = res.comment;

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              commentsCount: res.commentsCount ?? (p.commentsCount || 0) + 1,
              comments: [...(p.comments || []), newComment]
            };
          }
          return p;
        })
      );

      setSelectedPostDetail((prev) => {
        if (prev && prev.id === postId) {
          return {
            ...prev,
            commentsCount: res.commentsCount ?? (prev.commentsCount || 0) + 1,
            comments: [...(prev.comments || []), newComment]
          };
        }
        return prev;
      });

      return newComment;
    } catch (err) {
      showToast(err.message || "Failed to add comment");
      return null;
    }
  };

  // Delete Comment via backend API
  const deleteComment = async (postId, commentId) => {
    try {
      const res = await postService.deleteComment(commentId);

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              commentsCount:
                res.commentsCount ?? Math.max(0, (p.commentsCount || 1) - 1),
              comments: (p.comments || []).filter((c) => c.id !== commentId)
            };
          }
          return p;
        })
      );

      setSelectedPostDetail((prev) => {
        if (prev && prev.id === postId) {
          return {
            ...prev,
            commentsCount:
              res.commentsCount ?? Math.max(0, (prev.commentsCount || 1) - 1),
            comments: (prev.comments || []).filter((c) => c.id !== commentId)
          };
        }
        return prev;
      });

      showToast("Comment deleted");
      return true;
    } catch (err) {
      showToast(err.message || "Could not delete comment");
      return false;
    }
  };

  // Add New Post (called after successful backend upload)
  const addNewPost = (postPayload) => {
    const postToAdd = {
      id: postPayload.id || postPayload._id || "post_" + Date.now(),
      author: postPayload.author || {
        id: currentUser?.id || currentUser?._id,
        username: currentUser?.username || "me",
        fullName: currentUser?.fullName || "User",
        avatar: currentUser?.avatar,
        isPrivate: Boolean(currentUser?.isPrivate),
        isVerified: false
      },
      location: postPayload.location || "",
      mediaUrl: postPayload.mediaUrl,
      mediaType: postPayload.mediaType || "image",
      mediaAspect: postPayload.mediaAspect || "square",
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      isSaved: false,
      caption: postPayload.caption || "",
      createdAt: postPayload.createdAt || new Date().toISOString(),
      comments: []
    };

    setPosts((prev) => [postToAdd, ...prev]);
    setCurrentUser((prev) =>
      prev ? { ...prev, postsCount: (prev.postsCount || 0) + 1 } : prev
    );
    showToast("Post shared to feed!");
  };

  // Add New Story (called after successful backend upload)
  const addNewStory = (storyPayload) => {
    const newSlide = {
      id: storyPayload.id || storyPayload._id || "slide_" + Date.now(),
      mediaUrl: storyPayload.mediaUrl,
      mediaType: storyPayload.mediaType || "image",
      timestamp: "Just now",
      caption: (storyPayload.caption || "").trim() || undefined
    };

    setStories((prevStories) => {
      const existingUserStoryIndex = prevStories.findIndex(
        (s) =>
          currentUser &&
          (s.userId === currentUser.id ||
            s.userId === currentUser._id ||
            s.username === currentUser.username)
      );

      if (existingUserStoryIndex !== -1) {
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
        const newStoryEntry = {
          id: "story_user_me",
          userId: currentUser?.id || currentUser?._id || "user_me",
          username: currentUser?.username || "me",
          userAvatar: currentUser?.avatar,
          hasUnseen: true,
          stories: [newSlide]
        };
        return [newStoryEntry, ...prevStories];
      }
    });

    showToast("Added to your story!");
  };

  // Update follow status across suggestedUsers & currentUser stats
  const updateFollowState = useCallback(
    (targetUserId, { isFollowing, isPending, requestId }) => {
      setSuggestedUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId || u._id === targetUserId
            ? { ...u, isFollowing, isPending, requestId: requestId || null }
            : u
        )
      );
      // Re-fetch currentUser stats and feed to stay accurately synced with backend
      authService
        .getMe()
        .then((res) => {
          if (res?.user) setCurrentUser(res.user);
        })
        .catch(() => {});
      fetchFeed();
    },
    [fetchFeed]
  );

  // Follow / Unfollow / Cancel Request helper
  const toggleFollowUser = async (userId) => {
    const target = suggestedUsers.find((u) => u.id === userId || u._id === userId);
    if (!target) return;

    try {
      if (target.isFollowing) {
        await userService.unfollowUser(userId);
        updateFollowState(userId, { isFollowing: false, isPending: false, requestId: null });
        showToast(`Unfollowed @${target.username}`);
      } else if (target.isPending && target.requestId) {
        await followRequestService.cancelRequest(target.requestId);
        updateFollowState(userId, { isFollowing: false, isPending: false, requestId: null });
        showToast("Follow request cancelled");
      } else {
        const res = await userService.followUser(userId);
        updateFollowState(userId, {
          isFollowing: Boolean(res.isFollowing),
          isPending: Boolean(res.isPending),
          requestId: res.requestId || null
        });
        showToast(res.message || "Follow updated");
      }
    } catch (err) {
      showToast(err.message || "Could not update follow status");
    }
  };

  // Accept incoming follow request
  const acceptFollowRequest = async (requestId) => {
    try {
      const res = await followRequestService.acceptRequest(requestId);
      setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              followersCount: res.followersCount ?? (prev.followersCount || 0) + 1
            }
          : prev
      );
      showToast("Follow request accepted");
      return true;
    } catch (err) {
      showToast(err.message || "Failed to accept request");
      return false;
    }
  };

  // Reject incoming follow request
  const rejectFollowRequest = async (requestId) => {
    try {
      await followRequestService.rejectRequest(requestId);
      setFollowRequests((prev) => prev.filter((r) => r.id !== requestId));
      showToast("Follow request removed");
      return true;
    } catch (err) {
      showToast(err.message || "Failed to reject request");
      return false;
    }
  };

  // Update Account Privacy (Public / Private)
  const updatePrivacy = async (isPrivate) => {
    try {
      const res = await userService.updatePrivacy(isPrivate);
      if (res && res.user) {
        setCurrentUser(res.user);
      } else {
        setCurrentUser((prev) => (prev ? { ...prev, isPrivate } : prev));
      }
      fetchFollowRequests();
      showToast(res.message || `Account is now ${isPrivate ? "Private" : "Public"}`);
      return { success: true };
    } catch (err) {
      showToast(err.message || "Failed to update account privacy");
      return { success: false, error: err.message };
    }
  };

  // Update Profile via backend API
  const updateProfile = async ({ fullName, username, bio, website, avatar }) => {
    try {
      const res = await userService.updateProfile({
        fullName,
        username,
        bio,
        website,
        avatar
      });
      if (res && res.user) {
        setCurrentUser(res.user);
        showToast("Profile updated successfully");
        return { success: true, user: res.user };
      }
    } catch (err) {
      showToast(err.message || "Failed to update profile");
      return { success: false, error: err.message };
    }
  };

  // Send message (preserved for UI stability)
  const sendMessage = (convId, text) => {
    if (!text.trim() || !currentUser) return;
    const newMsg = {
      id: "msg_" + Date.now(),
      senderId: currentUser.id || currentUser._id,
      text: text.trim(),
      timestamp: "Just now"
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, newMsg] } : c))
    );
  };

  const createOrOpenConversation = (targetUser) => {
    if (!targetUser) return;
    const existing = conversations.find(
      (c) =>
        c.user.username.toLowerCase() === targetUser.username.toLowerCase() ||
        c.user.id === targetUser.id
    );
    if (existing) {
      setActiveConvId(existing.id);
      return existing.id;
    }
    const newId = "conv_" + Date.now();
    const newConversation = {
      id: newId,
      user: {
        id: targetUser.id || targetUser.username,
        username: targetUser.username,
        fullName: targetUser.fullName || targetUser.username,
        avatar: targetUser.avatar,
        isOnline: true
      },
      unreadCount: 0,
      messages: []
    };
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConvId(newId);
    return newId;
  };

  const markNotificationsAsRead = async () => {
    if (unreadCount === 0 && notifications.every((n) => n.isRead)) return;
    const prevNotifs = notifications;
    const prevUnread = unreadCount;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
      showToast("All notifications marked as read");
    } catch (err) {
      setNotifications(prevNotifs);
      setUnreadCount(prevUnread);
      showToast(err.message || "Failed to mark all as read");
    }
  };

  const markNotificationAsRead = async (id) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      const res = await notificationService.markAsRead(id);
      if (res && typeof res.unreadCount === "number") {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      setUnreadCount((c) => c + 1);
      console.error("[Notifications] markAsRead error:", err.message);
    }
  };

  const deleteNotification = async (id) => {
    const prevNotifs = notifications;
    const target = notifications.find((n) => n.id === id);

    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      const res = await notificationService.deleteNotification(id);
      if (res && typeof res.unreadCount === "number") {
        setUnreadCount(res.unreadCount);
      }
      showToast("Notification deleted");
    } catch (err) {
      setNotifications(prevNotifs);
      if (target && !target.isRead) {
        setUnreadCount((c) => c + 1);
      }
      showToast(err.message || "Failed to delete notification");
    }
  };

  const clearAllNotifications = async () => {
    const prevNotifs = notifications;
    const prevUnread = unreadCount;

    setNotifications([]);
    setUnreadCount(0);

    try {
      await notificationService.clearAllNotifications();
      showToast("All notifications cleared");
    } catch (err) {
      setNotifications(prevNotifs);
      setUnreadCount(prevUnread);
      showToast(err.message || "Failed to clear notifications");
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        setCurrentUser,
        updateProfile,
        updatePrivacy,
        isAuthenticated,
        authenticationLoading,
        fetchCurrentUser,
        login,
        signup,
        logout,
        posts,
        feedLoading,
        fetchFeed,
        savedPostIds,
        stories,
        setStories,
        activeStoryIndex,
        setActiveStoryIndex,
        suggestedUsers,
        fetchSuggestions,
        followRequests,
        fetchFollowRequests,
        acceptFollowRequest,
        rejectFollowRequest,
        updateFollowState,
        conversations,
        activeConvId,
        setActiveConvId,
        sendMessage,
        createOrOpenConversation,
        notifications,
        unreadCount,
        notificationsLoading,
        notificationsHasMore,
        notificationsPage,
        notificationsError,
        fetchNotifications,
        fetchUnreadCount,
        markNotificationsAsRead,
        markAsRead: markNotificationAsRead,
        markNotificationAsRead,
        markAllAsRead: markNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
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
        deleteComment,
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
