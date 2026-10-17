import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Search,
  Film,
  MessageCircle,
  Heart,
  PlusSquare,
  Menu,
  Sun,
  Moon,
  Bookmark,
  Settings,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { useApp } from "../../context/AppContext";

// Recognizable Instagram camera outline glyph
function InstagramCameraGlyph({ size = 26, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
    </svg>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const {
    currentUser,
    notifications,
    conversations,
    setIsCreateModalOpen,
    isSearchOpen,
    setIsSearchOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    theme,
    toggleTheme,
    logout
  } = useApp();

  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Unread counts
  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;
  const unreadMessagesCount = conversations.reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0
  );

  const isActive = (path) => location.pathname === path && !isSearchOpen;

  const handleSearchClick = () => {
    setIsSearchOpen(prev => !prev);
  };

  const isCollapsed = isSidebarCollapsed || isSearchOpen;

  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* 1. Brand Section */}
      <div className="sidebar-logo-container">
        <Link
          to="/"
          className="sidebar-brand"
          onClick={() => setIsSearchOpen(false)}
          title="Insta-V2 Home"
        >
          <div className="brand-logo-wrap">
            <InstagramCameraGlyph size={30} className="brand-camera-icon" />
          </div>
          <span className="brand-text">Insta-V2</span>
        </Link>
      </div>

      {/* 2. Primary Navigation Section */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
          {/* 1. Home */}
          <Link
            to="/"
            className={`nav-item ${isActive("/") ? "active" : ""}`}
            onClick={() => setIsSearchOpen(false)}
            title="Home"
          >
            <div className="nav-icon-wrapper">
              <Home size={24} strokeWidth={isActive("/") ? 2.5 : 1.8} />
            </div>
            <span className="nav-label">Home</span>
          </Link>

          {/* 2. Search */}
          <button
            type="button"
            className={`nav-item ${isSearchOpen || location.pathname === "/search" ? "active" : ""}`}
            onClick={handleSearchClick}
            title="Search"
          >
            <div className="nav-icon-wrapper">
              <Search
                size={24}
                strokeWidth={isSearchOpen || location.pathname === "/search" ? 2.5 : 1.8}
              />
            </div>
            <span className="nav-label">Search</span>
          </button>

          {/* 3. Reels */}
          <Link
            to="/reels"
            className={`nav-item ${isActive("/reels") ? "active" : ""}`}
            onClick={() => setIsSearchOpen(false)}
            title="Reels"
          >
            <div className="nav-icon-wrapper">
              <Film size={24} strokeWidth={isActive("/reels") ? 2.5 : 1.8} />
            </div>
            <span className="nav-label">Reels</span>
          </Link>

          {/* 4. Messages */}
          <Link
            to="/messages"
            className={`nav-item ${isActive("/messages") ? "active" : ""}`}
            onClick={() => setIsSearchOpen(false)}
            title="Messages"
          >
            <div className="nav-icon-wrapper">
              <MessageCircle
                size={24}
                strokeWidth={isActive("/messages") ? 2.5 : 1.8}
              />
              {unreadMessagesCount > 0 && (
                <span className="nav-badge">{unreadMessagesCount}</span>
              )}
            </div>
            <span className="nav-label">Messages</span>
          </Link>

          {/* 5. Notifications */}
          <Link
            to="/notifications"
            className={`nav-item ${isActive("/notifications") ? "active" : ""}`}
            onClick={() => setIsSearchOpen(false)}
            title="Notifications"
          >
            <div className="nav-icon-wrapper">
              <Heart
                size={24}
                strokeWidth={isActive("/notifications") ? 2.5 : 1.8}
              />
              {unreadNotifsCount > 0 && (
                <span className="nav-badge">{unreadNotifsCount}</span>
              )}
            </div>
            <span className="nav-label">Notifications</span>
          </Link>

          {/* 6. Create */}
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setIsSearchOpen(false);
              setIsCreateModalOpen(true);
            }}
            title="Create Post"
          >
            <div className="nav-icon-wrapper">
              <PlusSquare size={24} strokeWidth={1.8} />
            </div>
            <span className="nav-label">Create</span>
          </button>

          {/* 7. Profile */}
          <Link
            to="/profile"
            className={`nav-item ${isActive("/profile") ? "active" : ""}`}
            onClick={() => setIsSearchOpen(false)}
            title="Profile"
          >
            <div className="nav-icon-wrapper">
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className={`nav-avatar-mini ${isActive("/profile") ? "active-ring" : ""}`}
              />
            </div>
            <span className="nav-label">Profile</span>
          </Link>
        </nav>

      {/* 3. More Section (anchored at bottom) */}
      <div className="sidebar-bottom">
        {isMoreOpen && (
          <div className="more-menu-dropdown" role="menu">
            <button
              className="more-menu-item"
              onClick={() => {
                toggleSidebarCollapse();
                setIsMoreOpen(false);
              }}
              role="menuitem"
            >
              <span>{isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
              {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div className="more-menu-divider" />
            <button
              className="more-menu-item"
              onClick={toggleTheme}
              role="menuitem"
            >
              <span>Switch Appearance</span>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/saved"
              className="more-menu-item"
              onClick={() => {
                setIsSearchOpen(false);
                setIsMoreOpen(false);
              }}
              role="menuitem"
            >
              <span>Saved</span>
              <Bookmark size={18} />
            </Link>
            <Link
              to="/settings"
              className="more-menu-item"
              onClick={() => {
                setIsSearchOpen(false);
                setIsMoreOpen(false);
              }}
              role="menuitem"
            >
              <span>Settings</span>
              <Settings size={18} />
            </Link>
            <div className="more-menu-divider" />
            <button
              className="more-menu-item"
              onClick={() => {
                logout();
                setIsMoreOpen(false);
              }}
              role="menuitem"
            >
              <span>Switch Accounts</span>
            </button>
            <button
              className="more-menu-item"
              onClick={() => {
                logout();
                setIsMoreOpen(false);
              }}
              role="menuitem"
            >
              <span>Log Out</span>
            </button>
          </div>
        )}

        {/* Dedicated Sidebar Collapse / Expand Toggle Control */}
        <button
          type="button"
          className="nav-item sidebar-collapse-btn"
          onClick={toggleSidebarCollapse}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="nav-icon-wrapper">
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={24} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose size={24} strokeWidth={1.8} />
            )}
          </div>
          <span className="nav-label">
            {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>

        {/* More Options Button */}
        <button
          className={`nav-item ${isMoreOpen ? "active" : ""}`}
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          title="More options"
        >
          <div className="nav-icon-wrapper">
            <Menu size={24} strokeWidth={1.8} />
          </div>
          <span className="nav-label">More</span>
        </button>
      </div>
    </aside>
  );
}
