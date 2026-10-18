import React, { useState, useRef, useEffect } from "react";
import {
  SquarePen,
  Search,
  Phone,
  Video,
  Info,
  ArrowLeft,
  Image as ImageIcon,
  Smile,
  Heart,
  Send,
  X,
  Check,
  ChevronDown
} from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Messages() {
  const {
    conversations,
    activeConvId,
    setActiveConvId,
    sendMessage,
    createOrOpenConversation,
    currentUser,
    suggestedUsers,
    showToast
  } = useApp();

  const [inputMessage, setInputMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("messages"); // "messages" | "requests"
  const [showDetails, setShowDetails] = useState(false);
  const [showNewMsgModal, setShowNewMsgModal] = useState(false);
  const [newMsgSearch, setNewMsgSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeConversation = conversations.find(c => c.id === activeConvId) || conversations[0];

  // Auto-scroll chat thread to bottom when messages change
  useEffect(() => {
    if (activeConversation?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation?.messages, activeConvId]);

  // Handle selecting a conversation
  const handleSelectConversation = (id) => {
    setActiveConvId(id);
    setMobileShowChat(true);
  };

  // Handle Send text message
  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConversation) return;

    sendMessage(activeConversation.id, inputMessage.trim());
    setInputMessage("");
  };

  // Handle send quick heart reaction
  const handleSendHeart = () => {
    if (!activeConversation) return;
    sendMessage(activeConversation.id, "❤️");
  };

  // Handle simulated image attachment
  const handleImageAttachment = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      sendMessage(activeConversation.id, "📷 [Photo attached]");
      showToast("Photo sent!");
      e.target.value = "";
    }
  };

  // Handle emoji insert
  const handleInsertEmoji = (emoji) => {
    setInputMessage(prev => prev + emoji);
  };

  // Filtered conversations based on search
  const filteredConversations = conversations.filter(conv => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      conv.user.username.toLowerCase().includes(query) ||
      (conv.user.fullName && conv.user.fullName.toLowerCase().includes(query))
    );
  });

  // Filtered suggested users for New Message modal
  const filteredRecipients = suggestedUsers.filter(u => {
    const query = newMsgSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      u.username.toLowerCase().includes(query) ||
      (u.fullName && u.fullName.toLowerCase().includes(query))
    );
  });

  // Start chat with selected recipient in modal
  const handleStartChatFromModal = () => {
    if (!selectedRecipient) return;
    const newId = createOrOpenConversation(selectedRecipient);
    setShowNewMsgModal(false);
    setSelectedRecipient(null);
    setNewMsgSearch("");
    if (newId) {
      setActiveConvId(newId);
      setMobileShowChat(true);
    }
  };

  return (
    <div className="messages-workspace">
      {/* Hidden file input for media attachment demo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageAttachment}
      />

      {/* ----------------- 1. Conversations Inbox Panel ----------------- */}
      <aside className={`messages-inbox-panel ${mobileShowChat ? "mobile-hidden" : ""}`}>
        {/* Inbox Header with Account Switcher & Compose Button */}
        <header className="messages-inbox-header">
          <button
            type="button"
            className="messages-inbox-account-btn"
            onClick={() => showToast(`Signed in as @${currentUser.username}`)}
            title="Switch account"
          >
            <span className="messages-inbox-username">{currentUser.username}</span>
            <ChevronDown size={18} />
          </button>

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
              placeholder="Search"
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

        {/* Messages / Requests Tabs */}
        <div className="messages-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "messages"}
            className={`messages-tab-btn ${activeTab === "messages" ? "active" : ""}`}
            onClick={() => setActiveTab("messages")}
          >
            Messages
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "requests"}
            className={`messages-tab-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("requests");
              showToast("No new message requests");
            }}
          >
            Requests
          </button>
        </div>

        {/* Conversation List */}
        <div className="messages-conv-list" role="list">
          {activeTab === "requests" ? (
            <div className="messages-empty-filter">
              No message requests at this time.
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="messages-empty-filter">
              No conversations found for &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = conv.id === activeConversation?.id;
              const lastMsg = conv.messages[conv.messages.length - 1];
              const isUnread = conv.unreadCount > 0;

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
                      src={conv.user.avatar}
                      alt={conv.user.username}
                      className="messages-avatar-img"
                    />
                    {conv.user.isOnline && (
                      <span className="messages-online-badge" title="Active now" />
                    )}
                  </div>

                  <div className="messages-conv-info">
                    <div className="messages-conv-title-row">
                      <span className="messages-conv-username">
                        {conv.user.fullName || conv.user.username}
                      </span>
                    </div>
                    <div className="messages-conv-snippet-row">
                      <span className="messages-conv-snippet">
                        {lastMsg ? lastMsg.text : "Started a chat"}
                      </span>
                      <span className="messages-conv-time">
                        • {lastMsg?.timestamp || "Recently"}
                      </span>
                      {isUnread && <span className="messages-unread-dot" />}
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
                {/* Mobile Back Button */}
                <button
                  type="button"
                  className="messages-header-back-btn"
                  onClick={() => setMobileShowChat(false)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={22} />
                </button>

                <img
                  src={activeConversation.user.avatar}
                  alt={activeConversation.user.username}
                  className="messages-header-avatar"
                  onClick={() => setShowDetails(prev => !prev)}
                />

                <div
                  className="messages-header-details"
                  onClick={() => setShowDetails(prev => !prev)}
                >
                  <span className="messages-header-name">
                    {activeConversation.user.fullName || activeConversation.user.username}
                  </span>
                  <span className="messages-header-status">
                    {activeConversation.user.isOnline ? "Active now" : "Active recently"}
                  </span>
                </div>
              </div>

              {/* Chat action icons: Audio, Video, Info */}
              <div className="messages-chat-actions">
                <button
                  type="button"
                  className="messages-action-icon-btn"
                  onClick={() => showToast(`Starting audio call with ${activeConversation.user.username}...`)}
                  aria-label="Audio call"
                  title="Audio call"
                >
                  <Phone size={20} />
                </button>
                <button
                  type="button"
                  className="messages-action-icon-btn"
                  onClick={() => showToast(`Starting video call with ${activeConversation.user.username}...`)}
                  aria-label="Video call"
                  title="Video call"
                >
                  <Video size={20} />
                </button>
                <button
                  type="button"
                  className={`messages-action-icon-btn ${showDetails ? "active" : ""}`}
                  onClick={() => setShowDetails(prev => !prev)}
                  aria-label="Conversation details"
                  title="Details"
                >
                  <Info size={20} />
                </button>
              </div>
            </header>

            {/* Chat Thread Messages */}
            <div className="messages-thread">
              {/* Profile Intro at top of thread */}
              <div className="messages-thread-intro">
                <img
                  src={activeConversation.user.avatar}
                  alt={activeConversation.user.username}
                  className="messages-intro-avatar"
                />
                <h3 className="messages-intro-name">
                  {activeConversation.user.fullName || activeConversation.user.username}
                </h3>
                <p className="messages-intro-sub">
                  @{activeConversation.user.username} • Insta-V2
                </p>
                <button
                  type="button"
                  className="messages-intro-profile-btn"
                  onClick={() => showToast(`View profile: @${activeConversation.user.username}`)}
                >
                  View Profile
                </button>
              </div>

              {/* Message Bubbles */}
              {activeConversation.messages.map(msg => {
                const isMe = msg.senderId === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    className={`messages-bubble-row ${isMe ? "outgoing" : "incoming"}`}
                  >
                    <div className="messages-bubble">
                      {msg.text}
                    </div>
                    <span className="messages-bubble-meta">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer Pill */}
            <div className="messages-composer-area">
              <form onSubmit={handleSend} className="messages-composer-pill">
                {/* Emoji button */}
                <button
                  type="button"
                  className="messages-composer-tool-btn"
                  onClick={() => handleInsertEmoji("😊")}
                  aria-label="Add emoji"
                  title="Add emoji"
                >
                  <Smile size={22} />
                </button>

                {/* Text input */}
                <input
                  type="text"
                  placeholder="Message..."
                  className="messages-composer-input"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  aria-label="Write a message"
                />

                {/* Media attachment */}
                <button
                  type="button"
                  className="messages-composer-tool-btn"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach photo or video"
                  title="Attach photo or video"
                >
                  <ImageIcon size={22} />
                </button>

                {/* Send button when input has text, Heart button when empty */}
                {inputMessage.trim() ? (
                  <button
                    type="submit"
                    className="messages-composer-send-btn"
                    aria-label="Send message"
                  >
                    Send
                  </button>
                ) : (
                  <button
                    type="button"
                    className="messages-composer-tool-btn messages-composer-heart-btn"
                    onClick={handleSendHeart}
                    aria-label="Send heart"
                    title="Send heart"
                  >
                    <Heart size={22} />
                  </button>
                )}
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
              Send private photos and messages to a friend or group.
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

      {/* ----------------- 3. Details Drawer (toggled by Info) ----------------- */}
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
                src={activeConversation.user.avatar}
                alt={activeConversation.user.username}
                className="messages-details-avatar"
              />
              <span className="messages-details-fullname">
                {activeConversation.user.fullName || activeConversation.user.username}
              </span>
              <span className="messages-details-username">
                @{activeConversation.user.username}
              </span>
            </div>

            <div>
              <h4 className="messages-details-section-title">Members</h4>
              <div className="messages-details-option-row">
                <span>{activeConversation.user.username}</span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {activeConversation.user.isOnline ? "Active" : "Offline"}
                </span>
              </div>
            </div>

            <div>
              <h4 className="messages-details-section-title">Chat Settings</h4>
              <div className="messages-details-option-row">
                <span>Mute messages</span>
                <input
                  type="checkbox"
                  onChange={() => showToast("Notifications preference updated")}
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                className="messages-details-danger-btn"
                onClick={() => showToast(`Reported @${activeConversation.user.username}`)}
              >
                Report
              </button>
              <br />
              <button
                type="button"
                className="messages-details-danger-btn"
                onClick={() => showToast(`Blocked @${activeConversation.user.username}`)}
              >
                Block
              </button>
              <br />
              <button
                type="button"
                className="messages-details-danger-btn"
                onClick={() => {
                  showToast("Conversation deleted");
                  setShowDetails(false);
                }}
              >
                Delete Chat
              </button>
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
                placeholder="Search..."
                className="new-msg-search-input"
                value={newMsgSearch}
                onChange={(e) => setNewMsgSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="new-msg-list">
              <div className="new-msg-list-heading">Suggested</div>
              {filteredRecipients.map(user => {
                const isSelected = selectedRecipient?.id === user.id;

                return (
                  <div
                    key={user.id}
                    className="new-msg-user-row"
                    onClick={() => setSelectedRecipient(isSelected ? null : user)}
                  >
                    <div className="new-msg-user-left">
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="new-msg-avatar"
                      />
                      <div className="new-msg-names">
                        <span className="new-msg-username">{user.username}</span>
                        <span className="new-msg-fullname">{user.fullName || user.subtitle}</span>
                      </div>
                    </div>

                    <div className={`new-msg-checkbox ${isSelected ? "selected" : ""}`}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="new-msg-footer">
              <button
                type="button"
                className="new-msg-chat-btn"
                disabled={!selectedRecipient}
                onClick={handleStartChatFromModal}
              >
                Chat
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
