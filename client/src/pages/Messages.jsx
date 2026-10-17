import React, { useState } from "react";
import { Send, Phone, Video, Info, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Messages() {
  const {
    conversations,
    activeConvId,
    setActiveConvId,
    sendMessage,
    currentUser,
    showToast
  } = useApp();

  const [inputMessage, setInputMessage] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const activeConversation = conversations.find(c => c.id === activeConvId) || conversations[0];

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConversation) return;

    sendMessage(activeConversation.id, inputMessage);
    setInputMessage("");
  };

  const handleSelectConversation = (id) => {
    setActiveConvId(id);
    setMobileShowChat(true);
  };

  return (
    <div
      className="messages-container"
      style={{
        width: "100%",
        maxWidth: "935px",
        height: "calc(100vh - 40px)",
        margin: "20px auto",
        display: "flex",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-primary)",
        overflow: "hidden"
      }}
    >
      {/* Sidebar List */}
      <div
        className={`messages-sidebar ${mobileShowChat ? "mobile-hidden" : ""}`}
        style={{
          width: "350px",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* User bar */}
        <div
          style={{
            padding: "20px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span style={{ fontSize: "var(--font-size-md)", fontWeight: "700" }}>
            {currentUser.username}
          </span>
          <button
            onClick={() => showToast("Simulated: New message")}
            style={{ color: "var(--text-primary)" }}
            aria-label="New message"
          >
            <Send size={20} />
          </button>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {conversations.map(conv => {
            const isSelected = conv.id === activeConversation?.id;
            const lastMsg = conv.messages[conv.messages.length - 1];

            return (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--bg-hover)" : "transparent",
                  transition: "background-color 0.15s ease"
                }}
              >
                <div style={{ position: "relative" }}>
                  <img
                    src={conv.user.avatar}
                    alt={conv.user.username}
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                  {conv.user.isOnline && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "2px",
                        right: "2px",
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        border: "2px solid var(--bg-primary)"
                      }}
                    />
                  )}
                </div>

                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "600" }}>
                    {conv.user.username}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: "2px"
                    }}
                  >
                    {lastMsg ? lastMsg.text : "Started a chat"} • {lastMsg?.timestamp || "Recently"}
                  </div>
                </div>

                {conv.unreadCount > 0 && (
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "var(--accent-blue)"
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Chat Conversation */}
      <div
        className={`messages-chat ${!mobileShowChat ? "mobile-hidden" : ""}`}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg-primary)"
        }}
      >
        {activeConversation ? (
          <>
            {/* Header */}
            <div
              style={{
                height: "64px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Mobile Back button */}
                <button
                  onClick={() => setMobileShowChat(false)}
                  style={{ display: "none" }}
                  className="mobile-back-btn"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </button>
                <img
                  src={activeConversation.user.avatar}
                  alt={activeConversation.user.username}
                  style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                />
                <div>
                  <div style={{ fontSize: "var(--font-size-base)", fontWeight: "600" }}>
                    {activeConversation.user.username}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                    {activeConversation.user.isOnline ? "Active now" : "Offline"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button
                  onClick={() => showToast("Audio call is simulated in demo")}
                  style={{ color: "var(--text-primary)" }}
                  aria-label="Call"
                >
                  <Phone size={20} />
                </button>
                <button
                  onClick={() => showToast("Video call is simulated in demo")}
                  style={{ color: "var(--text-primary)" }}
                  aria-label="Video Call"
                >
                  <Video size={20} />
                </button>
                <button
                  onClick={() => showToast(`User details: ${activeConversation.user.fullName}`)}
                  style={{ color: "var(--text-primary)" }}
                  aria-label="Details"
                >
                  <Info size={20} />
                </button>
              </div>
            </div>

            {/* Message Feed */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              {activeConversation.messages.map(msg => {
                const isMe = msg.senderId === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMe ? "flex-end" : "flex-start",
                      maxWidth: "65%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start"
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "18px",
                        backgroundColor: isMe ? "var(--accent-blue)" : "var(--accent-gray-btn)",
                        color: isMe ? "#ffffff" : "var(--text-primary)",
                        fontSize: "var(--font-size-sm)",
                        lineHeight: "1.4",
                        wordBreak: "break-word"
                      }}
                    >
                      {msg.text}
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        marginTop: "2px",
                        padding: "0 4px"
                      }}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Message Input Field */}
            <form
              onSubmit={handleSend}
              style={{
                padding: "14px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "var(--radius-full)",
                  padding: "8px 16px",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                <input
                  type="text"
                  placeholder="Message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: "var(--font-size-sm)",
                    background: "transparent",
                    color: "var(--text-primary)"
                  }}
                />
                <button
                  type="button"
                  onClick={() => showToast("Image attachment simulated in demo")}
                  style={{ color: "var(--text-secondary)", marginLeft: "8px" }}
                  aria-label="Attach photo"
                >
                  <ImageIcon size={18} />
                </button>
              </div>

              {inputMessage.trim() ? (
                <button
                  type="submit"
                  style={{
                    color: "var(--accent-blue)",
                    fontWeight: "600",
                    fontSize: "var(--font-size-sm)",
                    padding: "6px"
                  }}
                >
                  Send
                </button>
              ) : null}
            </form>
          </>
        ) : (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--text-secondary)" }}>
            <Send size={64} strokeWidth={1} style={{ margin: "0 auto 12px auto" }} />
            <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: "600" }}>Your Messages</h3>
            <p style={{ fontSize: "var(--font-size-sm)", marginTop: "4px" }}>
              Send private photos and messages to a friend or group.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
