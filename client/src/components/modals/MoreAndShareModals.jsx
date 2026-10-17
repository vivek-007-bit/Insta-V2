import React, { useEffect, useState } from "react";
import { X, Search, Check } from "lucide-react";
import { useApp } from "../../context/AppContext";

export function MoreOptionsModal() {
  const { moreOptionsPost, setMoreOptionsPost, showToast, toggleSavePost } = useApp();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && moreOptionsPost) {
        setMoreOptionsPost(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moreOptionsPost, setMoreOptionsPost]);

  if (!moreOptionsPost) return null;

  const handleClose = () => setMoreOptionsPost(null);

  const handleCopyLink = () => {
    const fakeUrl = `${window.location.origin}/p/${moreOptionsPost.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fakeUrl).then(() => {
        showToast("Link copied to clipboard");
      }).catch(() => {
        showToast("Could not copy link");
      });
    } else {
      showToast("Link copied to clipboard (simulated)");
    }
    handleClose();
  };

  const handleReport = () => {
    showToast("Thank you. Post reported for review (demo)");
    handleClose();
  };

  const handleBookmark = () => {
    toggleSavePost(moreOptionsPost.id);
    handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-container options-modal" onClick={(e) => e.stopPropagation()}>
        <button className="options-btn danger" onClick={handleReport}>
          Report
        </button>
        <button className="options-btn" onClick={handleBookmark}>
          {moreOptionsPost.isSaved ? "Remove from Saved" : "Save to Collection"}
        </button>
        <button className="options-btn" onClick={handleCopyLink}>
          Copy link
        </button>
        <button
          className="options-btn"
          onClick={() => {
            showToast("Embed code copied to clipboard (demo)");
            handleClose();
          }}
        >
          Embed
        </button>
        <button
          className="options-btn"
          onClick={() => {
            showToast("About this account: Verified Creator");
            handleClose();
          }}
        >
          About this account
        </button>
        <button className="options-btn" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ShareDialogModal() {
  const { shareDialogPost, setShareDialogPost, suggestedUsers, showToast } = useApp();
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && shareDialogPost) {
        setShareDialogPost(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shareDialogPost, setShareDialogPost]);

  if (!shareDialogPost) return null;

  const handleClose = () => {
    setShareDialogPost(null);
    setSelectedUsers(new Set());
    setSearchQuery("");
  };

  const toggleSelectUser = (id) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = () => {
    showToast(`Shared post to ${selectedUsers.size} recipient(s)!`);
    handleClose();
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/p/${shareDialogPost.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(postUrl).then(() => {
        showToast("Link copied to clipboard");
      }).catch(() => {
        showToast("Link copied to clipboard (simulated)");
      });
    } else {
      showToast("Link copied to clipboard (simulated)");
    }
  };

  const filteredUsers = suggestedUsers.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div
        className="modal-container"
        style={{ width: "420px", height: "480px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-post-header">
          <div style={{ width: 20 }} />
          <h2 className="create-post-title">Share</h2>
          <button className="modal-close-x" style={{ position: "static", color: "var(--text-primary)" }} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "600" }}>To:</span>
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", width: "100%", fontSize: "var(--font-size-sm)", background: "transparent" }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "var(--font-size-xs)", fontWeight: "600", color: "var(--text-secondary)" }}>
            Suggested
          </div>
          {filteredUsers.map(u => {
            const isSelected = selectedUsers.has(u.id);
            return (
              <div
                key={u.id}
                onClick={() => toggleSelectUser(u.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  padding: "4px 0"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img src={u.avatar} alt={u.username} style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
                  <div>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "600" }}>{u.username}</div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>{u.fullName}</div>
                  </div>
                </div>
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: isSelected ? "none" : "2px solid var(--border-subtle)",
                    backgroundColor: isSelected ? "var(--accent-blue)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff"
                  }}
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "10px" }}>
          <button
            onClick={handleCopyLink}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--accent-gray-btn)",
              fontSize: "var(--font-size-sm)",
              fontWeight: "600"
            }}
          >
            Copy link
          </button>
          <button
            onClick={handleSend}
            disabled={selectedUsers.size === 0}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "var(--radius-md)",
              backgroundColor: selectedUsers.size > 0 ? "var(--accent-blue)" : "var(--accent-gray-btn)",
              color: selectedUsers.size > 0 ? "#ffffff" : "var(--text-secondary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: "600",
              cursor: selectedUsers.size > 0 ? "pointer" : "not-allowed"
            }}
          >
            Send ({selectedUsers.size})
          </button>
        </div>
      </div>
    </div>
  );
}
