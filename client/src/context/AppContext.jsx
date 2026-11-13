import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { getSocketOrigin } from "../services/api";
import authService from "../services/authService";
import postService from "../services/postService";
import userService from "../services/userService";
import followRequestService from "../services/followRequestService";
import notificationService from "../services/notificationService";
import storyService from "../services/storyService";
import messageService from "../services/messageService";
import searchService, { clearSearchCache } from "../services/searchService";
import recommendationService from "../services/recommendationService";

const AppContext = createContext();

// Module-level deduplication for concurrent mount / StrictMode GET /api/auth/me calls
let inFlightMePromise = null;

export function AppProvider({ children }) {
  // Search Panel overlay & persistent query/tab state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");

  // MongoDB-backed recent searches state
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentSearchesLoading, setRecentSearchesLoading] = useState(false);

  const fetchRecentSearches = useCallback(async () => {
    setRecentSearchesLoading(true);
    try {
      const res = await searchService.getRecentSearches();
      if (res && Array.isArray(res.recent)) {
        setRecentSearches(res.recent);
      }
    } catch (err) {
      console.error("[Search] Error fetching recent searches:", err.message);
    } finally {
      setRecentSearchesLoading(false);
    }
  }, []);

  const addRecentSearch = useCallback(async (input) => {
    if (!input) return;

    let payload = null;
    let optimisticItem = null;
    const nowIso = new Date().toISOString();

    if (input.type === "hashtag" || (typeof input === "string" && input.trim().startsWith("#"))) {
      const rawTag = input.hashtag || input;
      const cleanTag = String(rawTag).replace(/^#+/, "").trim().toLowerCase();
      if (!cleanTag) return;
      payload = { type: "hashtag", hashtag: cleanTag };
      optimisticItem = {
        id: `temp-tag-${cleanTag}`,
        type: "hashtag",
        hashtag: cleanTag,
        query: `#${cleanTag}`,
        searchedAt: nowIso,
        targetUser: null
      };
    } else if (input.type === "place") {
      const cleanLoc = String(input.location || input.name || "").trim();
      if (!cleanLoc) return;
      payload = { type: "place", location: cleanLoc };
      optimisticItem = {
        id: `temp-place-${cleanLoc.toLowerCase()}`,
        type: "place",
        location: cleanLoc,
        query: cleanLoc,
        searchedAt: nowIso,
        targetUser: null
      };
    } else if (input.type === "query") {
      const cleanQ = String(input.query || "").trim();
      if (!cleanQ) return;
      payload = { type: "query", query: cleanQ };
      optimisticItem = {
        id: `temp-query-${cleanQ.toLowerCase()}`,
        type: "query",
        query: cleanQ,
        searchedAt: nowIso,
        targetUser: null
      };
    } else {
      const userObj = input.targetUser || input;
      const targetUserId = userObj?.id || userObj?._id || input.targetUserId;
      if (!targetUserId) return;
      payload = { type: "user", targetUserId };
      optimisticItem = {
        id: `temp-user-${targetUserId}`,
        type: "user",
        query: userObj?.username || "",
        searchedAt: nowIso,
        targetUser: {
          id: targetUserId,
          username: userObj?.username || "",
          fullName: userObj?.fullName || "",
          avatar: userObj?.avatar || "",
          isPrivate: Boolean(userObj?.isPrivate)
        }
      };
    }

    const matchesSame = (entry) => {
      if (!entry || entry.type !== optimisticItem.type) return false;
      if (entry.type === "user") {
        return (
          (entry.targetUser?.id || entry.targetUser?._id) ===
          (optimisticItem.targetUser?.id || optimisticItem.targetUser?._id)
        );
      }
      if (entry.type === "hashtag") return entry.hashtag === optimisticItem.hashtag;
      if (entry.type === "place") return (entry.location || "").toLowerCase() === (optimisticItem.location || "").toLowerCase();
      return (entry.query || "").toLowerCase() === (optimisticItem.query || "").toLowerCase();
    };

    setRecentSearches((prev) => [optimisticItem, ...prev.filter((item) => !matchesSame(item))].slice(0, 20));

    try {
      const res = await searchService.addRecentSearch(payload);
      if (res?.item) {
        setRecentSearches((prev) => [res.item, ...prev.filter((item) => !matchesSame(item))].slice(0, 20));
      }
    } catch (err) {
      console.error("[Search] Error saving recent search:", err.message);
    }
  }, []);

  const removeRecentSearch = useCallback(async (idOrUsername) => {
    let targetId = idOrUsername;
    setRecentSearches((prev) => {
      const matched = prev.find(
        (item) =>
          item.id === idOrUsername ||
          item._id === idOrUsername ||
          item.targetUser?.username === idOrUsername ||
          item.username === idOrUsername
      );
      if (matched) targetId = matched.id || matched._id;
      return prev.filter(
        (item) =>
          item.id !== idOrUsername &&
          item._id !== idOrUsername &&
          item.targetUser?.username !== idOrUsername &&
          item.username !== idOrUsername
      );
    });

    if (targetId && !String(targetId).startsWith("temp-")) {
      try {
        await searchService.deleteRecentSearch(targetId);
      } catch (err) {
        console.error("[Search] Error deleting recent search:", err.message);
      }
    }
  }, []);

  const clearAllRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    try {
      await searchService.clearRecentSearches();
    } catch (err) {
      console.error("[Search] Error clearing recent searches:", err.message);
    }
  }, []);

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
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const isAuthenticatedRef = useRef(false);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Social States
  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const [savedPostIds, setSavedPostIds] = useState(() => new Set());
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState("");
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [suggestedUsersLoading, setSuggestedUsersLoading] = useState(false);
  const [suggestedUsersError, setSuggestedUsersError] = useState("");
  const [suggestedUsersPage, setSuggestedUsersPage] = useState(1);
  const [suggestedUsersHasMore, setSuggestedUsersHasMore] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);

  // Conversations, Messages & Real Backend Notifications
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState("");
  const [activeConvId, setActiveConvId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsHasMore, setNotificationsHasMore] = useState(false);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [notificationsError, setNotificationsError] = useState("");
  const socketRef = useRef(null);
  const activeConvIdRef = useRef(null);
  const currentUserRef = useRef(null);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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

  // Load active stories from MongoDB for Stories Bar
  const fetchStoriesFeed = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setStoriesLoading(true);
    }
    setStoriesError("");
    try {
      const res = await storyService.getStoriesFeed();
      if (res && Array.isArray(res.storyGroups)) {
        setStories(res.storyGroups);
      }
    } catch (err) {
      console.error("[Stories] Error fetching stories feed:", err.message);
      setStoriesError(err.message || "Failed to load stories");
    } finally {
      if (!silent) {
        setStoriesLoading(false);
      }
    }
  }, []);

  // Load recommended posts feed from Node.js (Cache -> Django ML -> MongoDB fallback)
  const [feedError, setFeedError] = useState("");
  const feedInFlightRef = useRef(false);

  const fetchFeed = useCallback(async () => {
    if (feedInFlightRef.current) return;
    feedInFlightRef.current = true;
    setFeedLoading(true);
    setFeedError("");
    try {
      let res;
      try {
        res = await recommendationService.getRecommendedPosts(1, 15);
      } catch {
        res = await postService.getFeedPosts(1, 15);
      }
      if (res && Array.isArray(res.posts)) {
        setPosts(res.posts);
        setFeedHasMore(Boolean(res.hasMore));
        setFeedPage(1);
      }
    } catch (err) {
      console.error("[Feed] Error fetching posts:", err.message);
      setFeedError(err.message || "Could not load feed.");
    } finally {
      feedInFlightRef.current = false;
      setFeedLoading(false);
    }
  }, []);

  // Load next page of recommended feed posts
  const loadMoreFeed = useCallback(async () => {
    if (loadingMoreFeed || !feedHasMore) return;
    setLoadingMoreFeed(true);
    const nextPage = feedPage + 1;
    try {
      let res;
      try {
        res = await recommendationService.getRecommendedPosts(nextPage, 15);
      } catch {
        res = await postService.getFeedPosts(nextPage, 15);
      }
      if (res && Array.isArray(res.posts)) {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNext = res.posts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNext];
        });
        setFeedHasMore(Boolean(res.hasMore));
        setFeedPage(nextPage);
      }
    } catch (err) {
      console.error("[Feed] Error loading more posts:", err.message);
    } finally {
      setLoadingMoreFeed(false);
    }
  }, [loadingMoreFeed, feedHasMore, feedPage]);

  // Load recommended users from ML recommendation pipeline (falling back to searchService.getSuggestions)
  const fetchSuggestions = useCallback(async (page = 1, append = false) => {
    setSuggestedUsersLoading(true);
    setSuggestedUsersError("");
    try {
      let usersList = [];
      let hasMore = false;
      try {
        const res = await recommendationService.getRecommendedUsers(page, 10);
        if (res && Array.isArray(res.users)) {
          usersList = res.users;
          hasMore = Boolean(res.hasMore);
        }
      } catch {
        // Fallback to search suggestions if recommendations endpoint errors
        const fallbackRes = await searchService.getSuggestions(10);
        if (fallbackRes && Array.isArray(fallbackRes.users)) {
          usersList = fallbackRes.users;
          hasMore = false;
        }
      }

      setSuggestedUsers((prev) => {
        if (!append || page === 1) return usersList;
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...usersList.filter((u) => !seen.has(u.id))];
      });
      setSuggestedUsersPage(page);
      setSuggestedUsersHasMore(hasMore);
    } catch (err) {
      console.error("[Users] Error fetching suggestions:", err.message);
      setSuggestedUsersError(err.message || "Failed to load user suggestions");
    } finally {
      setSuggestedUsersLoading(false);
    }
  }, []);

  const loadMoreSuggestedUsers = useCallback(async () => {
    if (suggestedUsersLoading || !suggestedUsersHasMore) return;
    await fetchSuggestions(suggestedUsersPage + 1, true);
  }, [fetchSuggestions, suggestedUsersLoading, suggestedUsersHasMore, suggestedUsersPage]);

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

  // Load real direct message conversations from MongoDB
  const fetchConversations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setConversationsLoading(true);
    }
    setConversationsError("");
    try {
      const res = await messageService.getConversations();
      if (res && Array.isArray(res.conversations)) {
        setConversations(res.conversations);
      }
    } catch (err) {
      console.error("[Messages] Error fetching conversations:", err.message);
      if (!silent) {
        setConversationsError(err.message || "Failed to load conversations");
      }
    } finally {
      if (!silent) {
        setConversationsLoading(false);
      }
    }
  }, []);

  // Load paginated messages for a specific conversation (newest initially, cursor for older)
  const loadConversationMessages = useCallback(async (convId, { before = null, limit = 25 } = {}) => {
    if (!convId) return null;
    try {
      const res = await messageService.getMessages(convId, { limit, before });
      const fetched = Array.isArray(res?.messages) ? res.messages : [];
      setMessagesByConv((prev) => {
        const existing = prev[convId] || { messages: [], hasMore: false, nextCursor: null };
        let merged;
        if (before) {
          // Prepend older messages, deduplicating by ID
          const existingIds = new Set(existing.messages.map((m) => m.id));
          const uniqueOlder = fetched.filter((m) => !existingIds.has(m.id));
          merged = [...uniqueOlder, ...existing.messages];
        } else if (existing.messages.length > 0 && existing.loaded) {
          // Silent refresh / reconnect: merge any new messages without wiping loaded history
          const existingIds = new Set(existing.messages.map((m) => m.id));
          const uniqueNew = fetched.filter((m) => !existingIds.has(m.id));
          merged = [...existing.messages, ...uniqueNew];
        } else {
          merged = fetched;
        }
        return {
          ...prev,
          [convId]: {
            messages: merged,
            hasMore: before ? Boolean(res.hasMore) : existing.loaded ? existing.hasMore : Boolean(res.hasMore),
            nextCursor: before ? res.nextCursor || null : existing.loaded ? existing.nextCursor : res.nextCursor || null,
            loaded: true
          }
        };
      });
      return res;
    } catch (err) {
      console.error("[Messages] Error loading messages:", err.message);
      throw err;
    }
  }, []);

  // Fetch current authenticated user session on mount (deduplicated across StrictMode)
  const fetchCurrentUser = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setAuthLoading(true);
    }

    try {
      if (!inFlightMePromise) {
        inFlightMePromise = authService.getMe().finally(() => {
          inFlightMePromise = null;
        });
      }

      const res = await inFlightMePromise;
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
      }
    } catch (err) {
      const isGenuineAuthFailure = Boolean(err?.isAuthError || err?.status === 401);
      const isNetworkOrServerIssue = Boolean(err?.isNetworkError || err?.status >= 500 || !err?.status);

      if (isGenuineAuthFailure) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
      } else if (isNetworkOrServerIssue) {
        setAuthError(err?.message || "Unable to reach the authentication server.");
        // Only leave unauthenticated on cold boot; do not force-logout an already active session on transient blips
        if (!isAuthenticatedRef.current) {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Synchronize mid-session 401 expiry from protected API calls
  useEffect(() => {
    const handleUnauthorized = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (isAuthenticatedRef.current) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        showToast("Your session has expired. Please log in again.");
      }
    };

    window.addEventListener("insta:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("insta:unauthorized", handleUnauthorized);
  }, [showToast]);

  // Fetch social data & connect real-time Socket.IO when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setPosts([]);
      setStories([]);
      setStoriesError("");
      setActiveStoryIndex(null);
      setSuggestedUsers([]);
      setFollowRequests([]);
      setConversations([]);
      setActiveConvId(null);
      setMessagesByConv({});
      setConversationsError("");
      setSocketConnected(false);
      setNotifications([]);
      setUnreadCount(0);
      setRecentSearches([]);
      setSearchQuery("");
      setSearchCategory("all");
      clearSearchCache();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    fetchFeed();
    fetchStoriesFeed();
    fetchSuggestions();
    fetchRecentSearches();
    fetchFollowRequests();
    fetchNotifications(1, false);
    fetchConversations();

    // Derive Socket.IO server origin from centralized API configuration
    const socketOrigin = getSocketOrigin();

    const socket = io(socketOrigin, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      const currentActiveConv = activeConvIdRef.current;
      if (currentActiveConv) {
        socket.emit("join_conversation", currentActiveConv);
        loadConversationMessages(currentActiveConv).catch(() => {});
      }
      fetchConversations({ silent: true });
    });

    socket.on("connect_error", (error) => {
      setSocketConnected(false);
      if (import.meta.env.DEV) {
        console.warn("[Socket.IO] Connection issue:", error.message || error);
      }
    });

    socket.on("reconnect", () => {
      setSocketConnected(true);
      const currentActiveConv = activeConvIdRef.current;
      if (currentActiveConv) {
        socket.emit("join_conversation", currentActiveConv);
      }
      fetchConversations({ silent: true });
    });

    socket.on("disconnect", (reason) => {
      setSocketConnected(false);
      if (reason === "io server disconnect") {
        // Disconnected by server, reconnect manually if authenticated
        socket.connect();
      }
    });

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

    socket.on("new_message", (payload) => {
      if (!payload || !payload.conversationId || !payload.message) return;
      const { conversationId, message } = payload;
      const myId = currentUserRef.current?.id || currentUserRef.current?._id;
      const isFromMe = myId && message.senderId === myId;
      const isViewingMessagesPage =
        typeof window !== "undefined" && window.location.pathname === "/messages";
      const isActiveChat = isViewingMessagesPage && activeConvIdRef.current === conversationId;

      setMessagesByConv((prev) => {
        const existing = prev[conversationId];
        if (!existing) return prev;
        if (existing.messages.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [conversationId]: {
            ...existing,
            messages: [...existing.messages, message]
          }
        };
      });

      let foundInList = false;
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== conversationId) return c;
          foundInList = true;
          const nextUnread =
            isFromMe || isActiveChat ? c.unreadCount : (c.unreadCount || 0) + 1;
          return {
            ...c,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            unreadCount: nextUnread
          };
        });
        updated.sort(
          (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
        return updated;
      });

      if (!foundInList) {
        fetchConversations({ silent: true });
      }
    });

    socket.on("messages_read", (payload) => {
      if (!payload || !payload.conversationId || !payload.readerId) return;
      const { conversationId, readerId, messageIds = [] } = payload;
      const myId = currentUserRef.current?.id || currentUserRef.current?._id;
      const idSet = new Set(messageIds);

      setMessagesByConv((prev) => {
        const existing = prev[conversationId];
        if (!existing) return prev;
        return {
          ...prev,
          [conversationId]: {
            ...existing,
            messages: existing.messages.map((m) => {
              if (!idSet.has(m.id) && idSet.size > 0) return m;
              const currentReadBy = m.readBy || [];
              if (currentReadBy.includes(readerId)) return m;
              return { ...m, readBy: [...currentReadBy, readerId] };
            })
          }
        };
      });

      if (myId && readerId === myId) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
        );
      }
    });

    socket.on("message_deleted", (payload) => {
      if (!payload || !payload.conversationId || !payload.messageId) return;
      const { conversationId, messageId, nextLastMessage } = payload;

      setMessagesByConv((prev) => {
        const existing = prev[conversationId];
        if (!existing) return prev;
        return {
          ...prev,
          [conversationId]: {
            ...existing,
            messages: existing.messages.filter((m) => m.id !== messageId)
          }
        };
      });

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          if (c.lastMessage?.id === messageId) {
            return {
              ...c,
              lastMessage: nextLastMessage || null,
              lastMessageAt: nextLastMessage?.createdAt || c.createdAt
            };
          }
          return c;
        })
      );
    });

    socket.on("user_presence", (payload) => {
      if (!payload || !payload.userId) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.user?.id === payload.userId
            ? { ...c, user: { ...c.user, isOnline: Boolean(payload.isOnline) } }
            : c
        )
      );
    });

    // Polling fallback when Socket.IO is disconnected (e.g. serverless environments)
    const pollMs = Math.max(5000, Number(import.meta.env.VITE_DM_POLL_INTERVAL_MS) || 15000);
    const fallbackPollInterval = setInterval(() => {
      if (!socketRef.current?.connected) {
        fetchUnreadCount();
        fetchConversations({ silent: true });
      }
    }, pollMs);

    return () => {
      clearInterval(fallbackPollInterval);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [
    isAuthenticated,
    fetchFeed,
    fetchStoriesFeed,
    fetchSuggestions,
    fetchRecentSearches,
    fetchFollowRequests,
    fetchNotifications,
    fetchUnreadCount,
    fetchConversations,
    loadConversationMessages
  ]);

  // Real Backend Login
  const login = async (identifier, password) => {
    try {
      const res = await authService.login({ identifier, password });
      if (res && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        setAuthError(null);
        setAuthLoading(false);
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
        setAuthError(null);
        setAuthLoading(false);
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
      setConversations([]);
      setActiveConvId(null);
      setMessagesByConv({});
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

  // Add New Story (called after successful backend upload & MongoDB persistence)
  const addNewStory = useCallback(
    (storyPayload) => {
      if (!storyPayload) return;
      const newSlide = {
        id: storyPayload.id || storyPayload._id,
        _id: storyPayload._id || storyPayload.id,
        userId: storyPayload.userId || currentUser?.id,
        mediaUrl: storyPayload.mediaUrl,
        publicId: storyPayload.publicId,
        mediaType: storyPayload.mediaType || "image",
        caption: (storyPayload.caption || "").trim(),
        isViewed: false,
        isOwner: true,
        viewersCount: 0,
        createdAt: storyPayload.createdAt || new Date().toISOString(),
        expiresAt: storyPayload.expiresAt
      };

      setStories((prevStories) => {
        const uid = currentUser?.id || currentUser?._id;
        const existingIndex = prevStories.findIndex(
          (s) =>
            currentUser &&
            (s.isOwn || s.userId === uid || s.username === currentUser.username)
        );

        if (existingIndex !== -1) {
          const existingGroup = prevStories[existingIndex];
          const updatedGroup = {
            ...existingGroup,
            isOwn: true,
            hasUnseen: true,
            latestCreatedAt: newSlide.createdAt,
            stories: [...existingGroup.stories, newSlide]
          };
          const remaining = prevStories.filter((_, idx) => idx !== existingIndex);
          return [updatedGroup, ...remaining];
        }

        const newStoryEntry = {
          id: `story_group_${uid || "me"}`,
          userId: uid,
          username: currentUser?.username || "me",
          fullName: currentUser?.fullName || currentUser?.username,
          userAvatar: currentUser?.avatar,
          isOwn: true,
          hasUnseen: true,
          latestCreatedAt: newSlide.createdAt,
          stories: [newSlide]
        };
        return [newStoryEntry, ...prevStories];
      });

      showToast("Added to your story!");
    },
    [currentUser, showToast]
  );

  // Mark an opened story slide as viewed and update ring state in place
  const markStoryViewed = useCallback((storyId) => {
    if (!storyId) return;
    setStories((prevStories) =>
      prevStories.map((group) => {
        if (!group.stories.some((slide) => slide.id === storyId)) {
          return group;
        }
        const updatedSlides = group.stories.map((slide) =>
          slide.id === storyId ? { ...slide, isViewed: true } : slide
        );
        const hasUnseen = updatedSlides.some((slide) => !slide.isViewed);
        return {
          ...group,
          stories: updatedSlides,
          hasUnseen
        };
      })
    );
  }, []);

  // Delete an owned story via backend API and update Stories Bar without reload
  const deleteStoryById = useCallback(
    async (storyId) => {
      if (!storyId) return false;
      try {
        await storyService.deleteStory(storyId);
        setStories((prevStories) =>
          prevStories
            .map((group) => {
              const filtered = group.stories.filter((s) => s.id !== storyId);
              if (filtered.length === group.stories.length) return group;
              return {
                ...group,
                stories: filtered,
                hasUnseen: filtered.some((s) => !s.isViewed)
              };
            })
            .filter((group) => group.stories.length > 0)
        );
        showToast("Story deleted");
        return true;
      } catch (err) {
        showToast(err.message || "Failed to delete story");
        return false;
      }
    },
    [showToast]
  );

  // Update follow status across suggestedUsers, search cache & currentUser stats
  const updateFollowState = useCallback(
    (targetUserId, { isFollowing, isPending, requestId }) => {
      clearSearchCache();
      setSuggestedUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId || u._id === targetUserId
            ? { ...u, isFollowing, isPending, requestId: requestId || null }
            : u
        )
      );
      setRecentSearches((prev) =>
        prev.map((item) =>
          item.targetUser && (item.targetUser.id === targetUserId || item.targetUser._id === targetUserId)
            ? {
                ...item,
                targetUser: {
                  ...item.targetUser,
                  isFollowing,
                  isPending,
                  requestId: requestId || null
                }
              }
            : item
        )
      );
      // Re-fetch currentUser stats, feed, and stories to stay accurately synced with backend
      authService
        .getMe()
        .then((res) => {
          if (res?.user) setCurrentUser(res.user);
        })
        .catch(() => {});
      fetchFeed();
      fetchStoriesFeed({ silent: true });
    },
    [fetchFeed, fetchStoriesFeed]
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
      return { success: false, error: res?.message || "Failed to update profile" };
    } catch (err) {
      showToast(err.message || "Failed to update profile");
      return { success: false, error: err.message };
    }
  };

  // Send real persistent text message via backend API (deduplicated against Socket.IO echo)
  const sendMessage = useCallback(async (convId, text) => {
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (!trimmed || !convId || !currentUserRef.current) return null;

    const res = await messageService.sendMessage(convId, trimmed);
    const savedMsg = res?.message;
    if (!savedMsg) return null;

    setMessagesByConv((prev) => {
      const existing = prev[convId] || { messages: [], hasMore: false, nextCursor: null, loaded: true };
      if (existing.messages.some((m) => m.id === savedMsg.id)) return prev;
      return {
        ...prev,
        [convId]: {
          ...existing,
          messages: [...existing.messages, savedMsg],
          loaded: true
        }
      };
    });

    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              lastMessage: savedMsg,
              lastMessageAt: savedMsg.createdAt
            }
          : c
      );
      updated.sort(
        (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
      );
      return updated;
    });

    return savedMsg;
  }, []);

  // Create or retrieve a 1-to-1 conversation in MongoDB
  const createOrOpenConversation = useCallback(async (targetUser) => {
    if (!targetUser) return null;
    try {
      const res = await messageService.createOrGetConversation({
        recipientId: targetUser.id || targetUser._id,
        username: targetUser.username
      });
      const conv = res?.conversation;
      if (!conv) return null;

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        if (exists) {
          return prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c));
        }
        return [conv, ...prev];
      });
      setActiveConvId(conv.id);
      return conv.id;
    } catch (err) {
      showToast(err.message || "Could not start conversation");
      return null;
    }
  }, [showToast]);

  // Mark received messages in a conversation as read when opened
  const markConversationAsRead = useCallback(async (convId) => {
    if (!convId) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
    try {
      await messageService.markAsRead(convId);
    } catch (err) {
      console.error("[Messages] Failed to mark read:", err.message);
    }
  }, []);

  // Delete an owned sent message
  const deleteDirectMessage = useCallback(
    async (messageId, convId) => {
      if (!messageId) return false;
      try {
        const res = await messageService.deleteMessage(messageId);
        setMessagesByConv((prev) => {
          const existing = prev[convId];
          if (!existing) return prev;
          return {
            ...prev,
            [convId]: {
              ...existing,
              messages: existing.messages.filter((m) => m.id !== messageId)
            }
          };
        });
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            if (c.lastMessage?.id === messageId) {
              return {
                ...c,
                lastMessage: res?.nextLastMessage || null,
                lastMessageAt: res?.nextLastMessage?.createdAt || c.createdAt
              };
            }
            return c;
          })
        );
        showToast("Message deleted");
        return true;
      } catch (err) {
        showToast(err.message || "Failed to delete message");
        return false;
      }
    },
    [showToast]
  );

  const joinConversationRoom = useCallback((convId) => {
    if (convId && socketRef.current?.connected) {
      socketRef.current.emit("join_conversation", convId);
    }
  }, []);

  const leaveConversationRoom = useCallback((convId) => {
    if (convId && socketRef.current?.connected) {
      socketRef.current.emit("leave_conversation", convId);
    }
  }, []);

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
        authLoading,
        authenticationLoading: authLoading,
        authError,
        fetchCurrentUser,
        login,
        signup,
        logout,
        posts,
        feedLoading,
        loadingMoreFeed,
        feedHasMore,
        fetchFeed,
        loadMoreFeed,
        savedPostIds,
        stories,
        storiesLoading,
        storiesError,
        setStories,
        fetchStoriesFeed,
        markStoryViewed,
        deleteStoryById,
        activeStoryIndex,
        setActiveStoryIndex,
        suggestedUsers,
        suggestedUsersLoading,
        suggestedUsersError,
        suggestedUsersHasMore,
        fetchSuggestions,
        loadMoreSuggestedUsers,
        followRequests,
        fetchFollowRequests,
        acceptFollowRequest,
        rejectFollowRequest,
        updateFollowState,
        conversations,
        conversationsLoading,
        conversationsError,
        socketConnected,
        activeConvId,
        setActiveConvId,
        messagesByConv,
        fetchConversations,
        loadConversationMessages,
        sendMessage,
        createOrOpenConversation,
        markConversationAsRead,
        deleteDirectMessage,
        joinConversationRoom,
        leaveConversationRoom,
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
        searchQuery,
        setSearchQuery,
        searchCategory,
        setSearchCategory,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebarCollapse,
        recentSearches,
        recentSearchesLoading,
        fetchRecentSearches,
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
        feedError
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
