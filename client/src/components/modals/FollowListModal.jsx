import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { X, Users } from "lucide-react";
import userService from "../../services/userService";
import FollowButton from "../shared/FollowButton";

export default function FollowListModal({ isOpen, onClose, userId, type = "followers" }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadList = useCallback(
    async (pageNum = 1, append = false) => {
      if (!userId || !isOpen) return;

      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      setError("");
      try {
        const res =
          type === "followers"
            ? await userService.getFollowers(userId, pageNum, 20)
            : await userService.getFollowing(userId, pageNum, 20);

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
      setUsers([]);
      loadList(1, false);
    }
  }, [isOpen, loadList]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStatusChange = (targetId, newStatus) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetId || u._id === targetId ? { ...u, ...newStatus } : u
      )
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container"
        style={{ width: "400px", maxWidth: "94vw", maxHeight: "460px", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-post-header" style={{ padding: "12px 16px" }}>
          <div style={{ width: 24 }} />
          <h2 className="create-post-title" style={{ textTransform: "capitalize" }}>
            {type}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--text-primary)", padding: "4px" }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* List Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-secondary)" }}>
              Loading...
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "36px 12px", color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
              {error}
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
              <Users size={40} style={{ margin: "0 auto 10px auto", opacity: 0.6 }} />
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>
                {type === "followers" ? "No followers yet" : "Not following anyone yet"}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", marginTop: "4px" }}>
                {type === "followers"
                  ? "People who follow this account will appear here."
                  : "Accounts followed by this user will appear here."}
              </div>
            </div>
          ) : (
            <>
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px"
                  }}
                >
                  <Link
                    to={`/profile/${u.username}`}
                    onClick={onClose}
                    style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}
                  >
                    <img
                      src={u.avatar}
                      alt={u.username}
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "1px solid var(--border-subtle)"
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: "var(--font-size-sm)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {u.username}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {u.fullName}
                      </div>
                    </div>
                  </Link>

                  <FollowButton
                    user={u}
                    onStatusChange={(newStatus) => handleStatusChange(u.id, newStatus)}
                  />
                </div>
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => loadList(page + 1, true)}
                  disabled={loadingMore}
                  style={{
                    padding: "8px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--accent-gray-btn)",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "600",
                    width: "100%",
                    marginTop: "6px"
                  }}
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
