import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import FollowButton from "../shared/FollowButton";

export default function RightPanel() {
  const { currentUser, suggestedUsers, showToast } = useApp();

  if (!currentUser) return null;

  return (
    <aside className="right-panel" aria-label="Suggested for you">
      {/* Current User Summary */}
      <div className="current-user-card">
        <Link to="/profile" className="user-card-info">
          <img
            src={currentUser.avatar}
            alt={currentUser.username}
            className="user-card-avatar"
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
        {suggestedUsers.length === 0 ? (
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", padding: "8px 0" }}>
            No other users registered yet.
          </div>
        ) : (
          suggestedUsers.map((user) => (
            <div key={user.id} className="suggestion-item">
              <Link to={`/profile/${user.username}`} className="suggestion-user-info">
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="suggestion-avatar"
                />
                <div className="suggestion-names">
                  <span className="suggestion-username">{user.username}</span>
                  <span className="suggestion-subtitle">
                    {user.fullName || "Insta-V2 user"}
                  </span>
                </div>
              </Link>
              <FollowButton user={user} />
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
