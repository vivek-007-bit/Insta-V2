import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { X, Users, Search, Lock } from "lucide-react";
import userService from "../../services/userService";
import FollowButton from "../shared/FollowButton";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";

export default function FollowListModal({ isOpen, onClose, userId, type = "followers" }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const didMutateRef = useRef(false);

  const handleClose = useCallback(() => {
    setSearchQuery("");
    onClose?.(didMutateRef.current);
  }, [onClose]);

  const loadList = useCallback(
    async (pageNum = 1, append = false) => {
      if (!userId || !isOpen) return;

      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      setError("");
      try {
        const res =
          type === "followers"
            ? await userService.getFollowers(userId, pageNum, 25)
            : await userService.getFollowing(userId, pageNum, 25);

        const list = type === "followers" ? res.followers : res.following;
        setUsers((prev) => (append ? [...prev, ...(list || [])] : list || []));
        setHasMore(Boolean(res.hasMore));
        setPage(pageNum);
      } catch (err) {
        setError(err.message || `Could not load ${type}`);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId, type, isOpen]
  );

  useEffect(() => {
    if (isOpen) {
      didMutateRef.current = false;
      setSearchQuery("");
      setUsers([]);
      loadList(1, false);
    }
  }, [isOpen, loadList]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const filteredUsers = useMemo(() => {
    const clean = searchQuery.trim().toLowerCase();
    if (!clean) return users;
    return users.filter(
      (u) =>
        (u.username || "").toLowerCase().includes(clean) ||
        (u.fullName || "").toLowerCase().includes(clean)
    );
  }, [users, searchQuery]);

  if (!isOpen) return null;

  const handleStatusChange = (targetId, newStatus) => {
    didMutateRef.current = true;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetId || u._id === targetId ? { ...u, ...newStatus } : u
      )
    );
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-list-modal-title"
    >
      <div className="modal-container follow-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="follow-modal-header">
          <div className="follow-modal-header-spacer" />
          <h2 id="follow-list-modal-title" className="follow-modal-title">
            {type}
          </h2>
          <button
            type="button"
            className="follow-modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sticky Search Input */}
        <div className="follow-modal-search-wrap">
          <div className="follow-modal-search-box">
            <Search size={15} className="follow-modal-search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="follow-modal-search-input"
              aria-label={`Search ${type}`}
            />
            {searchQuery && (
              <button
                type="button"
                className="follow-modal-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear filter"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List Body */}
        <div className="follow-modal-body">
          {loading ? (
            <div className="follow-modal-skeleton-list" aria-busy="true">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="follow-modal-skeleton-row">
                  <div className="follow-modal-skeleton-avatar" />
                  <div className="follow-modal-skeleton-lines">
                    <div className="follow-modal-skeleton-bar short" />
                    <div className="follow-modal-skeleton-bar long" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="follow-modal-empty">
              <p>{error}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="follow-modal-empty">
              <Users size={38} strokeWidth={1.5} />
              <h3>{type === "followers" ? "No followers yet" : "Not following anyone yet"}</h3>
              <p>
                {type === "followers"
                  ? "People who follow this account will appear here."
                  : "Accounts followed by this user will appear here."}
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="follow-modal-empty">
              <Search size={32} strokeWidth={1.5} />
              <h3>No results found</h3>
              <p>No {type} matched "{searchQuery.trim()}".</p>
            </div>
          ) : (
            <>
              <div className="follow-modal-list">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="follow-modal-row">
                    <Link
                      to={`/profile/${encodeURIComponent(u.username)}`}
                      onClick={() => onClose?.(false)}
                      className="follow-modal-user-link"
                    >
                      <img
                        src={
                          optimizeMediaUrl(u.avatar, { width: 150, isAvatar: true }) ||
                          getAvatarFallbackUrl(u.username)
                        }
                        alt={u.username}
                        className="follow-modal-avatar"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getAvatarFallbackUrl(u.username);
                        }}
                      />
                      <div className="follow-modal-user-meta">
                        <div className="follow-modal-username-row">
                          <span className="follow-modal-username">{u.username}</span>
                          {u.isPrivate && (
                            <Lock size={11} className="follow-modal-lock" aria-label="Private account" />
                          )}
                        </div>
                        {u.fullName && <span className="follow-modal-fullname">{u.fullName}</span>}
                      </div>
                    </Link>

                    <FollowButton
                      user={u}
                      className="follow-modal-action-btn"
                      onStatusChange={(newStatus) => handleStatusChange(u.id, newStatus)}
                    />
                  </div>
                ))}
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={() => loadList(page + 1, true)}
                  disabled={loadingMore}
                  className="follow-modal-load-more"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
