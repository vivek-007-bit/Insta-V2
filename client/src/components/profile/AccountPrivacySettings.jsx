import React, { useState } from "react";
import { Lock, Globe } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function AccountPrivacySettings() {
  const { currentUser, updatePrivacy } = useApp();
  const [updating, setUpdating] = useState(false);

  const isPrivate = Boolean(currentUser?.isPrivate);

  const handleTogglePrivacy = async () => {
    if (updating) return;
    setUpdating(true);
    await updatePrivacy(!isPrivate);
    setUpdating(false);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "16px",
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        {isPrivate ? (
          <Lock size={20} style={{ color: "var(--text-secondary)", marginTop: "2px", flexShrink: 0 }} />
        ) : (
          <Globe size={20} style={{ color: "var(--text-secondary)", marginTop: "2px", flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>
            Account Privacy:{" "}
            <span style={{ color: isPrivate ? "var(--accent-blue)" : "var(--text-primary)" }}>
              {isPrivate ? "Private" : "Public"}
            </span>
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "3px", lineHeight: "1.4" }}>
            {isPrivate
              ? "Only people you approve can see your photos, videos, followers, and following lists."
              : "Anyone on Insta-V2 can view your profile, posts, and follow you without approval."}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleTogglePrivacy}
        disabled={updating}
        style={{
          padding: "7px 14px",
          borderRadius: "var(--radius-md)",
          backgroundColor: isPrivate ? "var(--accent-blue)" : "var(--accent-gray-btn)",
          color: isPrivate ? "#ffffff" : "var(--text-primary)",
          fontSize: "var(--font-size-sm)",
          fontWeight: "600",
          flexShrink: 0,
          opacity: updating ? 0.7 : 1
        }}
      >
        {updating
          ? "Updating..."
          : isPrivate
          ? "Switch to Public"
          : "Switch to Private"}
      </button>
    </div>
  );
}
