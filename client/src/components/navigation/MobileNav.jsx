import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Film,
  PlusSquare,
  MessageCircle,
  Heart,
  Search
} from "lucide-react";
import { useApp } from "../../context/AppContext";

export function MobileTopBar() {
  const { notifications, conversations, setIsSearchOpen } = useApp();
  const unreadNotifs = notifications.filter(n => !n.isRead).length;
  const unreadMsgs = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <header className="mobile-top-bar">
      <div className="mobile-logo-wrap">
        <Link to="/" className="mobile-brand" onClick={() => setIsSearchOpen(false)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
          </svg>
          <span>Insta-V2</span>
        </Link>
      </div>
      <div className="mobile-top-actions">
        <Link to="/notifications" className="mobile-nav-btn" aria-label="Notifications" onClick={() => setIsSearchOpen(false)}>
          <Heart size={24} />
          {unreadNotifs > 0 && <span className="nav-badge">{unreadNotifs}</span>}
        </Link>
        <Link to="/messages" className="mobile-nav-btn" aria-label="Direct Messages" onClick={() => setIsSearchOpen(false)}>
          <MessageCircle size={24} />
          {unreadMsgs > 0 && <span className="nav-badge">{unreadMsgs}</span>}
        </Link>
      </div>
    </header>
  );
}

export function MobileBottomBar() {
  const location = useLocation();
  const { currentUser, setIsCreateModalOpen, isSearchOpen, setIsSearchOpen } = useApp();

  const isActive = (path) => location.pathname === path && !isSearchOpen;

  return (
    <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
      <Link
        to="/"
        className="mobile-nav-btn"
        aria-label="Home"
        onClick={() => setIsSearchOpen(false)}
      >
        <Home size={24} strokeWidth={isActive("/") ? 2.5 : 1.8} />
      </Link>

      <button
        type="button"
        className="mobile-nav-btn"
        aria-label="Search"
        onClick={() => setIsSearchOpen(prev => !prev)}
      >
        <Search
          size={24}
          strokeWidth={isSearchOpen || location.pathname === "/search" ? 2.5 : 1.8}
        />
      </button>

      <button
        type="button"
        className="mobile-nav-btn"
        onClick={() => {
          setIsSearchOpen(false);
          setIsCreateModalOpen(true);
        }}
        aria-label="Create Post"
      >
        <PlusSquare size={24} strokeWidth={1.8} />
      </button>

      <Link
        to="/reels"
        className="mobile-nav-btn"
        aria-label="Reels"
        onClick={() => setIsSearchOpen(false)}
      >
        <Film size={24} strokeWidth={isActive("/reels") ? 2.5 : 1.8} />
      </Link>

      <Link
        to="/profile"
        className="mobile-nav-btn"
        aria-label="Profile"
        onClick={() => setIsSearchOpen(false)}
      >
        <img
          src={currentUser.avatar}
          alt={currentUser.username}
          className={`nav-avatar-mini ${isActive("/profile") ? "active-ring" : ""}`}
        />
      </Link>
    </nav>
  );
}
