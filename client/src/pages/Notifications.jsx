import React from "react";
import { Heart, MessageCircle, UserPlus, AtSign, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Notifications() {
  const { notifications, markNotificationsAsRead, showToast } = useApp();

  const getIcon = (type) => {
    switch (type) {
      case "like":
        return <Heart size={14} fill="var(--accent-red)" color="var(--accent-red)" />;
      case "comment":
        return <MessageCircle size={14} fill="var(--accent-blue)" color="var(--accent-blue)" />;
      case "follow":
        return <UserPlus size={14} color="var(--accent-blue)" />;
      case "mention":
        return <AtSign size={14} color="#10b981" />;
      default:
        return <Heart size={14} />;
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "600px", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: "700" }}>Notifications</h1>
        <button
          onClick={markNotificationsAsRead}
          style={{
            color: "var(--accent-blue)",
            fontSize: "var(--font-size-sm)",
            fontWeight: "600"
          }}
        >
          Mark all as read
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifications.map(notif => (
          <div
            key={notif.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: notif.isRead ? "transparent" : "var(--accent-blue-subtle)",
              transition: "background-color 0.15s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ position: "relative" }}>
                <img
                  src={notif.user.avatar}
                  alt={notif.user.username}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    objectFit: "cover"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "-2px",
                    right: "-2px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "var(--bg-elevated)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  {getIcon(notif.type)}
                </div>
              </div>

              <div>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-primary)" }}>
                  <Link to="/profile" style={{ fontWeight: "600", marginRight: "4px" }}>
                    {notif.user.username}
                  </Link>
                  {notif.text}
                </p>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                  {notif.timestamp}
                </span>
              </div>
            </div>

            {/* Target Thumbnail or Follow Back */}
            {notif.targetThumbnail ? (
              <img
                src={notif.targetThumbnail}
                alt="Post thumbnail"
                style={{
                  width: "44px",
                  height: "44px",
                  objectFit: "cover",
                  borderRadius: "var(--radius-xs)"
                }}
              />
            ) : notif.type === "follow" ? (
              <button
                onClick={() => showToast(`Followed ${notif.user.username} back!`)}
                style={{
                  backgroundColor: "var(--accent-blue)",
                  color: "#ffffff",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: "600",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)"
                }}
              >
                Follow Back
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
