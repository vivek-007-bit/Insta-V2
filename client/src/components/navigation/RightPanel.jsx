import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export default function RightPanel() {
  const { currentUser, suggestedUsers, toggleFollowUser, showToast } = useApp();

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
        <button
          className="btn-switch-account"
          onClick={() => showToast("Simulated action: Switch account")}
        >
          Switch
        </button>
      </div>

      {/* Suggested Users Header */}
      <div className="suggestions-header">
        <span className="suggestions-title">Suggested for you</span>
        <button
          className="see-all-link"
          onClick={() => showToast("Viewing all suggestions")}
        >
          See All
        </button>
      </div>

      {/* Suggestions List */}
      <div className="suggestions-list">
        {suggestedUsers.map(user => (
          <div key={user.id} className="suggestion-item">
            <div className="suggestion-user-info">
              <img
                src={user.avatar}
                alt={user.username}
                className="suggestion-avatar"
              />
              <div className="suggestion-names">
                <span className="suggestion-username">{user.username}</span>
                <span className="suggestion-subtitle">{user.subtitle}</span>
              </div>
            </div>
            <button
              className={`btn-follow ${user.isFollowing ? "following" : ""}`}
              onClick={() => toggleFollowUser(user.id)}
            >
              {user.isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        ))}
      </div>

      {/* Information Footer */}
      <div className="footer-nav">
        <div className="footer-links">
          <a href="#about" onClick={(e) => { e.preventDefault(); showToast("About Insta-V2 Prototype"); }}>About</a> •
          <a href="#help" onClick={(e) => { e.preventDefault(); showToast("Help & Documentation"); }}>Help</a> •
          <a href="#press" onClick={(e) => { e.preventDefault(); showToast("Press Information"); }}>Press</a> •
          <a href="#api" onClick={(e) => { e.preventDefault(); showToast("API Documentation (Phase 2)"); }}>API</a> •
          <a href="#privacy" onClick={(e) => { e.preventDefault(); showToast("Privacy Terms"); }}>Privacy</a> •
          <a href="#terms" onClick={(e) => { e.preventDefault(); showToast("Prototype Terms"); }}>Terms</a> •
          <a href="#locations" onClick={(e) => { e.preventDefault(); showToast("Locations"); }}>Locations</a> •
          <a href="#language" onClick={(e) => { e.preventDefault(); showToast("Language: English (US)"); }}>Language</a>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} INSTA-V2 BY DEEPMIND PAIR PROGRAMMER
        </div>
      </div>
    </aside>
  );
}
