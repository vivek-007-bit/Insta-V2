import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  SquarePen,
  Search,
  Info,
  ArrowLeft,
  Smile,
  Send,
  X,
  Check,
  Trash2,
  RefreshCw,
  CheckCheck
} from "lucide-react";
import { useApp } from "../context/AppContext";
import userService from "../services/userService";
import { formatRelativeTime } from "../utils/formatTime";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../utils/cloudinaryUrl";

const MAX_MESSAGE_LENGTH = 5000;

function formatDateSeparator(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMessageTime(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const navigate = useNavigate();
  const {
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
    currentUser,
    suggestedUsers,
    showToast
  } = useApp();

  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showNewMsgModal, setShowNewMsgModal] = useState(false);
  const [newMsgSearch, setNewMsgSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);

  const threadRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const scrollRestoreRef = useRef(null);
  const lastMarkedMsgIdRef = useRef(null);

  const myId = currentUser?.id || currentUser?._id;
  const activeConversation = conversations.find((c) => c.id === activeConvId) || null;
  const activeThread = activeConversation
    ? messagesByConv[activeConversation.id] || {
        messages: [],
        hasMore: false,
        nextCursor: null,
        loaded: false
      }
    : { messages: [], hasMore: false, nextCursor: null, loaded: false };
  const activeMessages = activeThread.messages || [];

  // Default to first conversation on desktop if none selected
  useEffect(() => {
    if (!activeConvId && conversations.length > 0 && window.innerWidth > 768) {
      setActiveConvId(conversations[0].id);
    }
  }, [activeConvId, conversations, setActiveConvId]);

  // Ensure inbox conversations load when entering /messages
  useEffect(() => {
    fetchConversations({ silent: conversations.length > 0 });
  }, [fetchConversations, conversations.length]);

  // Join active conversation socket room, load newest messages, and mark read on open
  useEffect(() => {
    const convId = activeConversation?.id;
    if (!convId) return;

    let isCancelled = false;
    setThreadError("");
    isNearBottomRef.current = true;
    joinConversationRoom(convId);

    const loadInitial = async () => {
      if (!activeThread.loaded) {
        setThreadLoading(true);
      }
      try {
        await loadConversationMessages(convId, { limit: 25 });
        if (!isCancelled) {
          await markConversationAsRead(convId);
        }
      } catch (err) {
        if (!isCancelled) {
          setThreadError(err.message || "Unable to load messages");
        }
      } finally {
        if (!isCancelled) {
          setThreadLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      isCancelled = true;
      leaveConversationRoom(convId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id]);

  // Mark newly arriving messages as read immediately while conversation stays open
  useEffect(() => {
    const convId = activeConversation?.id;
    if (!convId || activeMessages.length === 0) return;

    const latest = activeMessages[activeMessages.length - 1];
    if (
      latest &&
      latest.senderId !== myId &&
      !latest.readBy?.includes(myId) &&
      lastMarkedMsgIdRef.current !== latest.id
    ) {
      lastMarkedMsgIdRef.current = latest.id;
      markConversationAsRead(convId);
    }
  }, [activeConversation?.id, activeMessages, myId, markConversationAsRead]);

  // Polling fallback when Socket.IO is unavailable (e.g. Vercel serverless)
  useEffect(() => {
    const convId = activeConversation?.id;
    if (!convId || socketConnected) return;

    const pollMs = Math.max(4000, Number(import.meta.env.VITE_DM_POLL_INTERVAL_MS) || 8000);
    const interval = setInterval(() => {
      loadConversationMessages(convId, { limit: 25 }).catch(() => {});
    }, pollMs);

    return () => clearInterval(interval);
  }, [activeConversation?.id, socketConnected, loadConversationMessages]);

  // Restore scroll position after prepending older messages OR scroll to bottom on new messages
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el) return;

    if (scrollRestoreRef.current) {
      const { prevHeight, prevTop } = scrollRestoreRef.current;
      el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      scrollRestoreRef.current = null;
      return;
    }

    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [activeMessages.length, activeConversation?.id]);

  // Escape closes New Message modal
  useEffect(() => {
    if (!showNewMsgModal) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowNewMsgModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showNewMsgModal]);

  // Live debounced user search for "New message" modal
  useEffect(() => {
    if (!showNewMsgModal) return;
    const trimmed = newMsgSearch.trim();
    if (!trimmed) {
      setUserSearchResults(suggestedUsers.filter((u) => u.id !== myId));
      setUserSearchLoading(false);
      return;
    }

    let cancelled = false;
    setUserSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await userService.searchUsers(trimmed, 20);
        if (!cancelled) {
          setUserSearchResults((res?.users || []).filter((u) => u.id !== myId));
        }
      } catch {
        if (!cancelled) {
          setUserSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setUserSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showNewMsgModal, newMsgSearch, suggestedUsers, myId]);

  const handleLoadOlder = useCallback(async () => {
    if (!activeConversation?.id || !activeThread.hasMore || loadingOlder || !activeThread.nextCursor) {
      return;
    }
    const el = threadRef.current;
    if (el) {
      scrollRestoreRef.current = {
        prevHeight: el.scrollHeight,
        prevTop: el.scrollTop
      };
    }
    setLoadingOlder(true);
    try {
      await loadConversationMessages(activeConversation.id, {
        before: activeThread.nextCursor,
        limit: 25
      });
    } catch {
      scrollRestoreRef.current = null;
      showToast("Failed to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }, [
    activeConversation?.id,
    activeThread.hasMore,
    activeThread.nextCursor,
    loadingOlder,
    loadConversationMessages,
    showToast
  ]);

  const handleThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;

    if (el.scrollTop <= 50 && activeThread.hasMore && !loadingOlder && !threadLoading) {
      handleLoadOlder();
    }
  };

  const handleSelectConversation = (id) => {
    setActiveConvId(id);
    setMobileShowChat(true);
    setShowDetails(false);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || !activeConversation || sending) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      showToast(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
      return;
    }

    setSending(true);
    isNearBottomRef.current = true;
    try {
      await sendMessage(activeConversation.id, trimmed);
      setInputMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      showToast(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComposerChange = (e) => {
    setInputMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleInsertEmoji = (emoji) => {
    setInputMessage((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleStartChatFromModal = async () => {
    if (!selectedRecipient || creatingChat) return;
    setCreatingChat(true);
    const convId = await createOrOpenConversation(selectedRecipient);
    setCreatingChat(false);
    setShowNewMsgModal(false);
    setSelectedRecipient(null);
    setNewMsgSearch("");
    if (convId) {
      setActiveConvId(convId);
      setMobileShowChat(true);
    }
  };

  // Filtered conversations based on sidebar username/fullName search
  const filteredConversations = conversations.filter((conv) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      conv.user?.username?.toLowerCase().includes(query) ||
      (conv.user?.fullName && conv.user.fullName.toLowerCase().includes(query))
    );
  });

  // Identify latest outgoing message read by the other participant for clean "Seen" indicator
  const otherUserId = activeConversation?.user?.id;
  let lastSeenOutgoingId = null;
  if (otherUserId && activeMessages.length > 0) {
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      const m = activeMessages[i];
      if (m.senderId === myId && Array.isArray(m.readBy) && m.readBy.includes(otherUserId)) {
        lastSeenOutgoingId = m.id;
        break;
      }
    }
  }

  const canSend =
    Boolean(inputMessage.trim()) &&
    !sending &&
    inputMessage.trim().length <= MAX_MESSAGE_LENGTH;

  return (
    <div className="messages-workspace">
      {/* ----------------- 1. Conversations Inbox Panel ----------------- */}
      <aside className={`messages-inbox-panel ${mobileShowChat ? "mobile-hidden" : ""}`}>
        {/* Inbox Header */}
        <header className="messages-inbox-header">
          <div className="messages-inbox-account-btn" style={{ cursor: "default" }}>
            <img
              src={
                optimizeMediaUrl(currentUser?.avatar, { width: 100, isAvatar: true }) ||
                getAvatarFallbackUrl(currentUser?.username)
              }
              alt={currentUser?.username}
              className="messages-inbox-self-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getAvatarFallbackUrl(currentUser?.username);
              }}
            />
            <span className="messages-inbox-username">{currentUser?.username}</span>
          </div>

          <button
            type="button"
            className="messages-compose-btn"
            onClick={() => setShowNewMsgModal(true)}
            aria-label="New message"
            title="New message"
          >
            <SquarePen size={22} strokeWidth={2} />
          </button>
        </header>

        {/* Search bar inside inbox */}
        <div className="messages-search-wrap">
          <div className="messages-search-input-box">
            <Search size={16} className="messages-search-icon" />
            <input
              type="text"
              placeholder="Search conversations"
              className="messages-search-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search direct messages"
            />
            {searchQuery && (
              <button
                type="button"
                className="messages-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="messages-conv-list" role="list">
          {conversationsLoading && conversations.length === 0 ? (
            <div className="messages-empty-filter">Loading conversations...</div>
          ) : conversationsError && conversations.length === 0 ? (
            <div className="messages-empty-filter">
              <p style={{ marginBottom: "10px" }}>{conversationsError}</p>
              <button
                type="button"
                className="messages-retry-btn"
                onClick={() => fetchConversations()}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="messages-empty-filter">
              No conversations yet. Start a new message!
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="messages-empty-filter">
              No conversations found for &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === activeConversation?.id;
              const lastMsg = conv.lastMessage;
              const isUnread = (conv.unreadCount || 0) > 0;
              const avatarSrc =
                optimizeMediaUrl(conv.user?.avatar, { width: 150, isAvatar: true }) ||
                getAvatarFallbackUrl(conv.user?.username);

              const snippetText = lastMsg
                ? `${lastMsg.senderId === myId ? "You: " : ""}${lastMsg.text}`
                : "No messages yet";

              return (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`messages-conv-row ${isSelected ? "active" : ""} ${isUnread ? "unread" : ""}`}
                  role="listitem"
                >
                  <div className="messages-avatar-wrapper">
                    <img
                      src={avatarSrc}
                      alt={conv.user?.username}
                      className="messages-avatar-img"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getAvatarFallbackUrl(conv.user?.username);
                      }}
                    />
                    {conv.user?.isOnline && (
                      <span className="messages-online-badge" title="Active now" />
                    )}
                  </div>

                  <div className="messages-conv-info">
                    <div className="messages-conv-title-row">
                      <span className="messages-conv-username">
                        {conv.user?.username}
                      </span>
                    </div>
                    <div className="messages-conv-snippet-row">
                      <span className="messages-conv-snippet">{snippetText}</span>
                      <span className="messages-conv-time">
                        • {formatRelativeTime(conv.lastMessageAt || conv.updatedAt)}
                      </span>
                      {isUnread && (
                        <span
                          className="messages-unread-dot"
                          aria-label={`${conv.unreadCount} unread`}
                        />
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ----------------- 2. Active Chat Panel ----------------- */}
      <main className={`messages-chat-panel ${!mobileShowChat ? "mobile-hidden" : ""}`}>
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <header className="messages-chat-header">
              <div className="messages-chat-user-target">
                <button
                  type="button"
                  className="messages-header-back-btn"
                  onClick={() => setMobileShowChat(false)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={22} />
                </button>

                <img
                  src={
                    optimizeMediaUrl(activeConversation.user?.avatar, { width: 150, isAvatar: true }) ||
                    getAvatarFallbackUrl(activeConversation.user?.username)
                  }
                  alt={activeConversation.user?.username}
                  className="messages-header-avatar"
                  onClick={() => navigate(`/profile/${activeConversation.user?.username}`)}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getAvatarFallbackUrl(activeConversation.user?.username);
                  }}
                />

                <div
                  className="messages-header-details"
                  onClick={() => navigate(`/profile/${activeConversation.user?.username}`)}
                >
                  <span className="messages-header-name">
                    {activeConversation.user?.fullName || activeConversation.user?.username}
                  </span>
                  <span className="messages-header-status">
                    @{activeConversation.user?.username}
                    {socketConnected && activeConversation.user?.isOnline ? " • Active now" : ""}
                  </span>
                </div>
              </div>

              <div className="messages-chat-actions">
                <button
                  type="button"
                  className={`messages-action-icon-btn ${showDetails ? "active" : ""}`}
                  onClick={() => setShowDetails((prev) => !prev)}
                  aria-label="Conversation details"
                  title="Details"
                >
                  <Info size={20} />
                </button>
              </div>
            </header>

            {/* Chat Thread Messages */}
            <div
              className="messages-thread"
              ref={threadRef}
              onScroll={handleThreadScroll}
            >
              {/* Older Pagination Status */}
              {activeThread.hasMore && (
                <div className="messages-load-older-wrap">
                  <button
                    type="button"
                    className="messages-load-older-btn"
                    onClick={handleLoadOlder}
                    disabled={loadingOlder}
                  >
                    {loadingOlder ? "Loading older messages..." : "Load older messages"}
                  </button>
                </div>
              )}

              {/* Profile Intro at top when all older messages are loaded */}
              {!activeThread.hasMore && (
                <div className="messages-thread-intro">
                  <img
                    src={
                      optimizeMediaUrl(activeConversation.user?.avatar, { width: 200, isAvatar: true }) ||
                      getAvatarFallbackUrl(activeConversation.user?.username)
                    }
                    alt={activeConversation.user?.username}
                    className="messages-intro-avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getAvatarFallbackUrl(activeConversation.user?.username);
                    }}
                  />
                  <h3 className="messages-intro-name">
                    {activeConversation.user?.fullName || activeConversation.user?.username}
                  </h3>
                  <p className="messages-intro-sub">
                    @{activeConversation.user?.username} • Insta-V2
                  </p>
                  <button
                    type="button"
                    className="messages-intro-profile-btn"
                    onClick={() => navigate(`/profile/${activeConversation.user?.username}`)}
                  >
                    View Profile
                  </button>
                </div>
              )}

              {threadLoading && activeMessages.length === 0 ? (
                <div className="messages-empty-filter">Loading messages...</div>
              ) : threadError && activeMessages.length === 0 ? (
                <div className="messages-empty-filter">
                  <p style={{ marginBottom: "8px" }}>{threadError}</p>
                  <button
                    type="button"
                    className="messages-retry-btn"
                    onClick={() => loadConversationMessages(activeConversation.id, { limit: 25 })}
                  >
                    <RefreshCw size={14} />
                    <span>Retry</span>
                  </button>
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="messages-empty-filter">
                  Say hello to @{activeConversation.user?.username} to start the conversation.
                </div>
              ) : (
                activeMessages.map((msg, idx) => {
                  const isMe = msg.senderId === myId;
                  const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                  const curDay = new Date(msg.createdAt).toDateString();
                  const prevDay = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
                  const showDateSep = curDay !== prevDay;
                  const isLastSeen = isMe && msg.id === lastSeenOutgoingId;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSep && (
                        <div className="messages-date-separator">
                          <span>{formatDateSeparator(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className={`messages-bubble-row ${isMe ? "outgoing" : "incoming"}`}>
                        <div className="messages-bubble-wrap">
                          {isMe && (
                            <button
                              type="button"
                              className="messages-delete-msg-btn"
                              onClick={() => deleteDirectMessage(msg.id, activeConversation.id)}
                              aria-label="Delete message"
                              title="Delete message"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <div className="messages-bubble">{msg.text}</div>
                        </div>
                        <span className="messages-bubble-meta">
                          {formatMessageTime(msg.createdAt)}
                          {isLastSeen && (
                            <span className="messages-seen-tag" title="Seen">
                              <CheckCheck size={13} />
                              <span>Seen</span>
                            </span>
                          )}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Text-Only Message Composer Pill */}
            <div className="messages-composer-area">
              <form onSubmit={handleSend} className="messages-composer-pill">
                <button
                  type="button"
                  className="messages-composer-tool-btn"
                  onClick={() => handleInsertEmoji("😊")}
                  aria-label="Add emoji"
                  title="Add emoji"
                >
                  <Smile size={22} />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder="Message..."
                  className="messages-composer-input messages-composer-textarea"
                  value={inputMessage}
                  onChange={handleComposerChange}
                  onKeyDown={handleComposerKeyDown}
                  maxLength={MAX_MESSAGE_LENGTH + 50}
                  aria-label="Write a message"
                />

                {inputMessage.length > 4500 && (
                  <span
                    className={`messages-char-counter ${
                      inputMessage.trim().length > MAX_MESSAGE_LENGTH ? "over-limit" : ""
                    }`}
                  >
                    {inputMessage.trim().length}/{MAX_MESSAGE_LENGTH}
                  </span>
                )}

                <button
                  type="submit"
                  className="messages-composer-send-btn"
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  {sending ? "..." : "Send"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="messages-empty-state">
            <div className="messages-empty-icon-ring">
              <Send size={44} strokeWidth={1.5} />
            </div>
            <h2 className="messages-empty-title">Your Messages</h2>
            <p className="messages-empty-sub">
              Send private text messages directly to friends on Insta-V2.
            </p>
            <button
              type="button"
              className="messages-empty-btn"
              onClick={() => setShowNewMsgModal(true)}
            >
              Send Message
            </button>
          </div>
        )}
      </main>

      {/* ----------------- 3. Details Drawer ----------------- */}
      {showDetails && activeConversation && (
        <aside className="messages-details-drawer">
          <header className="messages-details-header">
            <span className="messages-details-title">Details</span>
            <button
              type="button"
              className="messages-details-close-btn"
              onClick={() => setShowDetails(false)}
              aria-label="Close details"
            >
              <X size={20} />
            </button>
          </header>

          <div className="messages-details-content">
            <div className="messages-details-user-box">
              <img
                src={
                  optimizeMediaUrl(activeConversation.user?.avatar, { width: 200, isAvatar: true }) ||
                  getAvatarFallbackUrl(activeConversation.user?.username)
                }
                alt={activeConversation.user?.username}
                className="messages-details-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getAvatarFallbackUrl(activeConversation.user?.username);
                }}
              />
              <span className="messages-details-fullname">
                {activeConversation.user?.fullName || activeConversation.user?.username}
              </span>
              <span className="messages-details-username">
                @{activeConversation.user?.username}
              </span>
              <button
                type="button"
                className="messages-intro-profile-btn"
                style={{ marginTop: "8px" }}
                onClick={() => navigate(`/profile/${activeConversation.user?.username}`)}
              >
                View Profile
              </button>
            </div>

            <div>
              <h4 className="messages-details-section-title">Member</h4>
              <div className="messages-details-option-row">
                <span>@{activeConversation.user?.username}</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {socketConnected && activeConversation.user?.isOnline ? "Active now" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ----------------- 4. New Message Modal ----------------- */}
      {showNewMsgModal && (
        <div
          className="new-msg-modal-overlay"
          onClick={() => setShowNewMsgModal(false)}
        >
          <div
            className="new-msg-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-msg-title"
          >
            <header className="new-msg-header">
              <button
                type="button"
                className="new-msg-close-btn"
                onClick={() => setShowNewMsgModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <span id="new-msg-title" className="new-msg-title">New message</span>
              <div style={{ width: 24 }} />
            </header>

            <div className="new-msg-search-section">
              <span className="new-msg-to-label">To:</span>
              <input
                type="text"
                placeholder="Search username..."
                className="new-msg-search-input"
                value={newMsgSearch}
                onChange={(e) => setNewMsgSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="new-msg-list">
              <div className="new-msg-list-heading">
                {newMsgSearch.trim() ? "Search Results" : "Suggested"}
              </div>
              {userSearchLoading ? (
                <div className="messages-empty-filter">Searching users...</div>
              ) : userSearchResults.length === 0 ? (
                <div className="messages-empty-filter">No matching users found.</div>
              ) : (
                userSearchResults.map((user) => {
                  const isSelected = selectedRecipient?.id === user.id;

                  return (
                    <div
                      key={user.id}
                      className="new-msg-user-row"
                      onClick={() => setSelectedRecipient(isSelected ? null : user)}
                    >
                      <div className="new-msg-user-left">
                        <img
                          src={
                            optimizeMediaUrl(user.avatar, { width: 120, isAvatar: true }) ||
                            getAvatarFallbackUrl(user.username)
                          }
                          alt={user.username}
                          className="new-msg-avatar"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getAvatarFallbackUrl(user.username);
                          }}
                        />
                        <div className="new-msg-names">
                          <span className="new-msg-username">{user.username}</span>
                          <span className="new-msg-fullname">{user.fullName || user.username}</span>
                        </div>
                      </div>

                      <div className={`new-msg-checkbox ${isSelected ? "selected" : ""}`}>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <footer className="new-msg-footer">
              <button
                type="button"
                className="new-msg-chat-btn"
                disabled={!selectedRecipient || creatingChat}
                onClick={handleStartChatFromModal}
              >
                {creatingChat ? "Opening chat..." : "Chat"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
