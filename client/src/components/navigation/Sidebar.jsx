import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, Bookmark, Settings } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";
import {
  InstagramCameraGlyph,
  IgHomeIcon,
  IgSearchIcon,
  IgReelsIcon,
  IgMessagesIcon,
  IgNotificationsIcon,
  IgCreateIcon,
  IgMoreIcon,
  IgSidebarCollapseIcon
} from "./InstagramNavIcons";

export default function Sidebar() {
  const location = useLocation();
  const {
    currentUser,
    unreadCount,
    conversations,
    isCreateModalOpen,
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
  const bottomRef = useRef(null);

  // Close More popover on outside click or Escape
  useEffect(() => {
    if (!isMoreOpen) return undefined;
    const handleClickOutside = (e) => {
      if (bottomRef.current && !bottomRef.current.contains(e.target)) {
        setIsMoreOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsMoreOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);

  if (!currentUser) return null;

  const totalUnreadNotifs = unreadCount || 0;
  const unreadNotifsLabel = totalUnreadNotifs > 99 ? "99+" : totalUnreadNotifs;
  const unreadMessagesCount = conversations.reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0
  );

  const isHomeActive = location.pathname === "/" && !isSearchOpen;
  const isSearchActive =
    isSearchOpen || location.pathname === "/search" || location.pathname === "/explore";
  const isReelsActive =
    (location.pathname === "/reels" || location.pathname.startsWith("/reels/")) && !isSearchOpen;
  const isMessagesActive = location.pathname === "/messages" && !isSearchOpen;
  const isNotificationsActive = location.pathname === "/notifications" && !isSearchOpen;
  const isProfileActive =
    (location.pathname === "/profile" ||
      location.pathname.toLowerCase() === `/profile/${currentUser.username.toLowerCase()}`) &&
    !isSearchOpen;

  const handleSearchClick = () => {
    setIsSearchOpen((prev) => !prev);
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
          aria-label="Insta-V2 Home"
        >
          <div className="brand-logo-wrap">
            <InstagramCameraGlyph size={26} className="brand-camera-icon" />
          </div>
          <span className="brand-text">Insta-V2</span>
        </Link>
      </div>

      {/* 2. Primary Navigation Section */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        {/* Home */}
        <Link
          to="/"
          className={`nav-item ${isHomeActive ? "active" : ""}`}
          onClick={() => setIsSearchOpen(false)}
          title="Home"
          aria-label="Home"
          aria-current={isHomeActive ? "page" : undefined}
        >
          <div className="nav-icon-wrapper">
            <IgHomeIcon active={isHomeActive} size={24} className="nav-ig-icon" />
          </div>
          <span className="nav-label">Home</span>
        </Link>

        {/* Search */}
        <button
          type="button"
          className={`nav-item ${isSearchActive ? "active" : ""}`}
          onClick={handleSearchClick}
          title="Search"
          aria-label="Search"
          aria-pressed={isSearchOpen}
        >
          <div className="nav-icon-wrapper">
            <IgSearchIcon active={isSearchActive} size={24} className="nav-ig-icon" />
          </div>
          <span className="nav-label">Search</span>
        </button>

        {/* Reels */}
        <Link
          to="/reels"
          className={`nav-item ${isReelsActive ? "active" : ""}`}
          onClick={() => setIsSearchOpen(false)}
          title="Reels"
          aria-label="Reels"
          aria-current={isReelsActive ? "page" : undefined}
        >
          <div className="nav-icon-wrapper">
            <IgReelsIcon active={isReelsActive} size={24} className="nav-ig-icon" />
          </div>
          <span className="nav-label">Reels</span>
        </Link>

        {/* Messages */}
        <Link
          to="/messages"
          className={`nav-item ${isMessagesActive ? "active" : ""}`}
          onClick={() => setIsSearchOpen(false)}
          title="Messages"
          aria-label="Messages"
          aria-current={isMessagesActive ? "page" : undefined}
        >
          <div className="nav-icon-wrapper">
            <IgMessagesIcon active={isMessagesActive} size={24} className="nav-ig-icon" />
            {unreadMessagesCount > 0 && (
              <span className="nav-badge">{unreadMessagesCount}</span>
            )}
          </div>
          <span className="nav-label">Messages</span>
        </Link>

        {/* Notifications */}
        <Link
          to="/notifications"
          className={`nav-item ${isNotificationsActive ? "active" : ""}`}
          onClick={() => setIsSearchOpen(false)}
          title="Notifications"
          aria-label="Notifications"
          aria-current={isNotificationsActive ? "page" : undefined}
        >
          <div className="nav-icon-wrapper">
            <IgNotificationsIcon
              active={isNotificationsActive}
              size={24}
              className="nav-ig-icon"
            />
            {totalUnreadNotifs > 0 && (
              <span className="nav-badge">{unreadNotifsLabel}</span>
            )}
          </div>
          <span className="nav-label">Notifications</span>
        </Link>

        {/* Create */}
        <button
          type="button"
          className={`nav-item ${isCreateModalOpen ? "active" : ""}`}
          onClick={() => {
            setIsSearchOpen(false);
            setIsCreateModalOpen(true);
          }}
          title="Create"
          aria-label="Create post"
          aria-pressed={isCreateModalOpen}
        >
          <div className="nav-icon-wrapper">
            <IgCreateIcon active={isCreateModalOpen} size={24} className="nav-ig-icon" />
          </div>
          <span className="nav-label">Create</span>
        </button>

        {/* Profile */}
        <Link
          to="/profile"
          className={`nav-item ${isProfileActive ? "active" : ""}`}
          onClick={() => setIsSearchOpen(false)}
          title="Profile"
          aria-label="Profile"
          aria-current={isProfileActive ? "page" : undefined}
        >
          <div className="nav-icon-wrapper">
            <img
              src={
                optimizeMediaUrl(currentUser.avatar, { width: 100, isAvatar: true }) ||
                getAvatarFallbackUrl(currentUser.username)
              }
              alt={currentUser.username}
              className={`nav-avatar-mini ${isProfileActive ? "active-ring" : ""}`}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getAvatarFallbackUrl(currentUser.username);
              }}
            />
          </div>
          <span className="nav-label">Profile</span>
        </Link>
      </nav>

      {/* 3. Bottom Controls (Collapse + More anchored at bottom) */}
      <div className="sidebar-bottom" ref={bottomRef}>
        {isMoreOpen && (
          <div className="more-menu-dropdown" role="menu">
            <button
              type="button"
              className="more-menu-item"
              onClick={() => {
                toggleSidebarCollapse();
                setIsMoreOpen(false);
              }}
              role="menuitem"
            >
              <span>{isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
              <IgSidebarCollapseIcon collapsed={isSidebarCollapsed} size={18} />
            </button>
            <div className="more-menu-divider" />
            <button
              type="button"
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
              type="button"
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
              type="button"
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
            <IgSidebarCollapseIcon collapsed={isSidebarCollapsed} size={24} className="nav-ig-icon" />
          </div>
          <span className="nav-label">
            {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>

        {/* More Options Button */}
        <button
          type="button"
          className={`nav-item ${isMoreOpen ? "active" : ""}`}
          onClick={() => setIsMoreOpen((prev) => !prev)}
          title="More"
          aria-label="More options"
          aria-expanded={isMoreOpen}
        >
          <div className="nav-icon-wrapper">
            <IgMoreIcon active={isMoreOpen} size={24} className="nav-ig-icon" />
          </div>
          <span className="nav-label">More</span>
        </button>
      </div>
    </aside>
  );
}
