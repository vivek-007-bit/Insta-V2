import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { X, Trash2, Smile } from "lucide-react";
import { useApp } from "../../context/AppContext";
import reelService from "../../services/reelService";
import { formatRelativeTime } from "../../utils/formatTime";

export default function ReelCommentsModal({ reel, isOpen, onClose, onCommentsCountChange }) {
  const { currentUser, showToast } = useApp();

  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const inputRef = useRef(null);

  const loadComments = useCallback(
    async (pageNum = 1, append = false) => {
      if (!reel?.id || !isOpen) return;
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await reelService.getComments(reel.id, pageNum, 20);
        if (res && Array.isArray(res.comments)) {
          setComments((prev) => (append ? [...prev, ...res.comments] : res.comments));
          setHasMore(Boolean(res.hasMore));
          setPage(pageNum);
        }
      } catch (err) {
        showToast(err.message || "Could not load comments");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [reel?.id, isOpen, showToast]
  );

  useEffect(() => {
    if (isOpen) {
      setComments([]);
      setCommentText("");
      loadComments(1, false);
    }
  }, [isOpen, loadComments]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !reel) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await reelService.addComment(reel.id, trimmed);
      if (res && res.comment) {
        setComments((prev) => [res.comment, ...prev]);
        setCommentText("");
        onCommentsCountChange?.(reel.id, res.commentsCount);
      }
    } catch (err) {
      showToast(err.message || "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      const res = await reelService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentsCountChange?.(reel.id, res.commentsCount);
      showToast("Comment deleted");
    } catch (err) {
      showToast(err.message || "Could not delete comment");
    } finally {
      setDeletingId(null);
    }
  };

  const handleReply = (username) => {
    setCommentText(`@${username} `);
    inputRef.current?.focus();
  };

  const currentUserId = currentUser?.id || currentUser?._id;
  const reelOwnerId = reel.author?.id || reel.author?._id;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container"
        style={{
          width: "420px",
          maxWidth: "94vw",
          height: "520px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-post-header" style={{ padding: "12px 16px" }}>
          <div style={{ width: 24 }} />
          <h2 className="create-post-title">Comments</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--text-primary)", padding: "4px" }}
            aria-label="Close comments"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div
          className="post-detail-comments-list"
          style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-secondary)" }}>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>
                No comments yet
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", marginTop: "4px" }}>
                Start the conversation.
              </div>
            </div>
          ) : (
            <>
              {comments.map((comm) => {
                const canDelete =
                  currentUserId &&
                  (comm.userId === currentUserId || reelOwnerId === currentUserId);

                const avatarSrc =
                  comm.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(comm.username)}&background=262626&color=ffffff&size=100`;

                return (
                  <div key={comm.id} className="post-detail-comment-item">
                    <Link
                      to={`/profile/${comm.username}`}
                      className="post-detail-comment-avatar-link"
                      onClick={onClose}
                    >
                      <img
                        src={avatarSrc}
                        alt={comm.username}
                        className="post-detail-comment-avatar"
                      />
                    </Link>

                    <div className="post-detail-comment-body">
                      <div className="post-detail-comment-text-wrap">
                        <Link
                          to={`/profile/${comm.username}`}
                          className="post-detail-comment-user"
                          onClick={onClose}
                        >
                          {comm.username}
                        </Link>
                        <span className="post-detail-comment-content">{comm.text}</span>
                      </div>

                      <div className="post-detail-comment-meta">
                        <span className="post-detail-comment-time">
                          {formatRelativeTime(comm.createdAt)}
                        </span>
                        <button
                          type="button"
                          className="post-detail-comment-reply-btn"
                          onClick={() => handleReply(comm.username)}
                        >
                          Reply
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(comm.id)}
                            disabled={deletingId === comm.id}
                            title="Delete comment"
                            aria-label="Delete comment"
                            style={{
                              color: "var(--text-secondary)",
                              marginLeft: "4px",
                              display: "inline-flex",
                              alignItems: "center",
                              opacity: deletingId === comm.id ? 0.5 : 0.85
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <button
                    type="button"
                    onClick={() => loadComments(page + 1, true)}
                    disabled={loadingMore}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600",
                      color: "var(--text-secondary)",
                      padding: "6px 12px"
                    }}
                  >
                    {loadingMore ? "Loading..." : "Load more comments"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Composer */}
        <form className="post-detail-comment-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className="post-detail-emoji-btn"
            title="Insert emoji"
            aria-label="Insert emoji"
            onClick={() => {
              setCommentText((prev) => (prev ? prev + " 🔥" : "🔥 "));
              inputRef.current?.focus();
            }}
          >
            <Smile size={22} strokeWidth={1.8} />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a comment..."
            className="post-detail-comment-input"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            className="post-detail-comment-submit"
            disabled={!commentText.trim() || submitting}
          >
            {submitting ? "..." : "Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
