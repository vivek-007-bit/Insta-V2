import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trash2, CheckCircle2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import postService from "../../services/postService";
import { formatRelativeTime } from "../../utils/formatTime";

export default function CommentsSection({ post, onReply, onCloseModal }) {
  const { currentUser, deleteComment } = useApp();
  const [comments, setComments] = useState(post?.comments || []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadComments = useCallback(
    async (pageNum = 1, append = false) => {
      if (!post?.id) return;
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await postService.getComments(post.id, pageNum, 20);
        if (res && Array.isArray(res.comments)) {
          setComments((prev) => (append ? [...prev, ...res.comments] : res.comments));
          setHasMore(Boolean(res.hasMore));
          setPage(pageNum);
        }
      } catch (err) {
        console.error("[Comments] Error loading comments:", err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [post?.id]
  );

  // Initial fetch when post changes
  useEffect(() => {
    loadComments(1, false);
  }, [loadComments]);

  // Sync newly added/deleted comments from parent post state
  useEffect(() => {
    if (post?.comments && post.comments.length > 0) {
      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newOnes = post.comments.filter((c) => !existingIds.has(c.id));
        if (newOnes.length === 0) return prev;
        return [...newOnes, ...prev];
      });
    }
  }, [post?.comments]);

  const handleDelete = async (commentId) => {
    if (deletingId) return;
    setDeletingId(commentId);
    const success = await deleteComment(post.id, commentId);
    if (success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
    setDeletingId(null);
  };

  const currentUserId = currentUser?.id || currentUser?._id;
  const postOwnerId = post?.author?.id;

  return (
    <div className="post-detail-comments-list">
      {/* Original caption as first item */}
      {post.caption && (
        <div className="post-detail-comment-item">
          <Link
            to={`/profile/${post.author.username}`}
            className="post-detail-comment-avatar-link"
            onClick={onCloseModal}
            title={post.author.username}
          >
            <img
              src={post.author.avatar}
              alt={post.author.username}
              className="post-detail-comment-avatar"
            />
          </Link>
          <div className="post-detail-comment-body">
            <div className="post-detail-comment-text-wrap">
              <Link
                to={`/profile/${post.author.username}`}
                className="post-detail-comment-user"
                onClick={onCloseModal}
              >
                {post.author.username}
              </Link>
              {post.author.isVerified && (
                <CheckCircle2
                  size={12}
                  className="verified-badge inline-verified"
                  fill="currentColor"
                />
              )}
              <span className="post-detail-comment-content">{post.caption}</span>
            </div>
            <div className="post-detail-comment-meta">
              <span className="post-detail-comment-time">
                {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && comments.length === 0 && (
        <div style={{ padding: "16px", textAlign: "center", fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
          Loading comments...
        </div>
      )}

      {/* Empty comments */}
      {!loading && comments.length === 0 && (
        <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
          No comments yet. Start the conversation.
        </div>
      )}

      {/* Comments List */}
      {comments.map((comm) => {
        const canDelete =
          currentUserId &&
          (comm.userId === currentUserId || postOwnerId === currentUserId);

        const avatarSrc =
          comm.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(comm.username)}&background=262626&color=ffffff&size=100`;

        return (
          <div key={comm.id} className="post-detail-comment-item">
            <Link
              to={`/profile/${comm.username}`}
              className="post-detail-comment-avatar-link"
              onClick={onCloseModal}
              title={comm.username}
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
                  onClick={onCloseModal}
                >
                  {comm.username}
                </Link>
                <span className="post-detail-comment-content">{comm.text}</span>
              </div>
              <div className="post-detail-comment-meta">
                <span className="post-detail-comment-time">
                  {formatRelativeTime(comm.createdAt)}
                </span>
                {onReply && (
                  <button
                    type="button"
                    className="post-detail-comment-reply-btn"
                    onClick={() => onReply(comm.username)}
                  >
                    Reply
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comm.id)}
                    disabled={deletingId === comm.id}
                    title="Delete comment"
                    aria-label="Delete comment"
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "var(--font-size-xs)",
                      marginLeft: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
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

      {/* Load more comments */}
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
    </div>
  );
}
