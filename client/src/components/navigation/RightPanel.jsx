import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import FollowButton from "../shared/FollowButton";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";

export default function RightPanel() {
  const {
    currentUser,
    suggestedUsers,
    suggestedUsersLoading,
    suggestedUsersError,
    fetchSuggestions,
    showToast
  } = useApp();

  if (!currentUser) return null;

  const currentAvatar =
    optimizeMediaUrl(currentUser.avatar, { width: 150, isAvatar: true }) ||
    getAvatarFallbackUrl(currentUser.username);

  return (
    <aside className="right-panel" aria-label="Suggested for you">
      {/* Current User Summary */}
      <div className="current-user-card">
        <Link to="/profile" className="user-card-info">
          <img
            src={currentAvatar}
            alt={currentUser.username}
            className="user-card-avatar"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getAvatarFallbackUrl(currentUser.username);
            }}
          />
          <div className="user-card-names">
            <span className="user-card-username">{currentUser.username}</span>
            <span className="user-card-fullname">{currentUser.fullName}</span>
          </div>
        </Link>
        <Link to="/settings" className="btn-switch-account">
          Settings
        </Link>
      </div>

      {/* Suggested Users Header */}
      <div className="suggestions-header">
        <span className="suggestions-title">Suggested for you</span>
        <Link to="/search" className="see-all-link">
          See All
        </Link>
      </div>

      {/* Suggestions List */}
      <div className="suggestions-list">
        {suggestedUsersLoading && suggestedUsers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--bg-elevated)", animation: "pulse 1.5s infinite" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "80px", height: "10px", backgroundColor: "var(--bg-elevated)", borderRadius: "4px", marginBottom: "6px" }} />
                  <div style={{ width: "120px", height: "8px", backgroundColor: "var(--bg-elevated)", borderRadius: "4px" }} />
                </div>
              </div>
            ))}
          </div>
        ) : suggestedUsersError && suggestedUsers.length === 0 ? (
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", padding: "8px 0" }}>
            <span>Could not load suggestions. </span>
            <button
              type="button"
              onClick={() => fetchSuggestions()}
              style={{ color: "var(--accent-blue)", fontWeight: "600", background: "none", border: "none", cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        ) : suggestedUsers.length === 0 ? (
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", padding: "8px 0" }}>
            No suggested accounts right now.
          </div>
        ) : (
          suggestedUsers.slice(0, 5).map((user) => (
            <div key={user.id} className="suggestion-item">
              <Link to={`/profile/${user.username}`} className="suggestion-user-info">
                <img
                  src={
                    optimizeMediaUrl(user.avatar, { width: 150, isAvatar: true }) ||
                    getAvatarFallbackUrl(user.username)
                  }
                  alt={user.username}
                  className="suggestion-avatar"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getAvatarFallbackUrl(user.username);
                  }}
                />
                <div className="suggestion-names">
                  <span className="suggestion-username">{user.username}</span>
                  <span className="suggestion-subtitle" style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.subtitle || user.fullName || "Suggested for you"}
                  </span>
                </div>
              </Link>
              <FollowButton user={user} variant="link" />
            </div>
          ))
        )}
      </div>

      {/* Information Footer */}
      <div className="footer-nav">
        <div className="footer-links">
          <a href="#about" onClick={(e) => { e.preventDefault(); showToast("Insta-V2 Social Platform"); }}>About</a> •
          <a href="#help" onClick={(e) => { e.preventDefault(); showToast("Help & Documentation"); }}>Help</a> •
          <a href="#privacy" onClick={(e) => { e.preventDefault(); showToast("Privacy Terms"); }}>Privacy</a> •
          <a href="#terms" onClick={(e) => { e.preventDefault(); showToast("Terms of Service"); }}>Terms</a>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} INSTA-V2
        </div>
      </div>
    </aside>
  );
}
