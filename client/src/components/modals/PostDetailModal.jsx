import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  CheckCircle2,
  Smile
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import CommentsSection from "../posts/CommentsSection";
import ShareButton from "../posts/ShareButton";
import { formatRelativeTime } from "../../utils/formatTime";

export default function PostDetailModal() {
  const {
    selectedPostDetail,
    setSelectedPostDetail,
    toggleLikePost,
    toggleSavePost,
    setMoreOptionsPost,
    addComment
  } = useApp();

  const [commentText, setCommentText] = useState("");
  const [modalDims, setModalDims] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentInputRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedPostDetail) {
        setSelectedPostDetail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPostDetail, setSelectedPostDetail]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (selectedPostDetail) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedPostDetail]);

  // Compute proportional dimensions based on natural media aspect ratio on desktop
  useEffect(() => {
    if (!selectedPostDetail?.mediaUrl) return;

    let isMounted = true;
    const img = new Image();
    img.src = selectedPostDetail.mediaUrl;
    img.onload = () => {
      if (!isMounted || !img.naturalWidth || !img.naturalHeight) return;
      const naturalAspect = img.naturalWidth / img.naturalHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (vw <= 768) {
        if (isMounted) setModalDims(null);
        return;
      }

      const maxModalHeight = Math.min(vh - 64, 850);
      const minModalHeight = 480;
      const detailsWidth = 410;

      let modalHeight;
      let mediaWidth;

      if (naturalAspect <= 0.82) {
        modalHeight = maxModalHeight;
        mediaWidth = Math.min(modalHeight * naturalAspect, 640);
      } else if (naturalAspect <= 1.05) {
        modalHeight = Math.min(maxModalHeight, 720);
        mediaWidth = modalHeight;
      } else if (naturalAspect <= 1.5) {
        modalHeight = Math.max(minModalHeight, Math.min(maxModalHeight, 620 / naturalAspect));
        mediaWidth = modalHeight * naturalAspect;
      } else {
        modalHeight = Math.max(minModalHeight, Math.min(maxModalHeight, 520));
        mediaWidth = Math.min(modalHeight * naturalAspect, 680);
      }

      const maxAvailableMediaWidth = Math.max(300, vw - detailsWidth - 96);
      if (mediaWidth > maxAvailableMediaWidth) {
        mediaWidth = maxAvailableMediaWidth;
        modalHeight = Math.max(minModalHeight, Math.min(maxModalHeight, mediaWidth / naturalAspect));
      }

      if (isMounted) {
        setModalDims({
          height: `${Math.round(modalHeight)}px`,
          width: `${Math.round(mediaWidth + detailsWidth)}px`,
          mediaWidth: `${Math.round(mediaWidth)}px`
        });
      }
    };

    return () => {
      isMounted = false;
    };
  }, [selectedPostDetail?.mediaUrl]);

  if (!selectedPostDetail) return null;

  const handleClose = () => setSelectedPostDetail(null);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    const created = await addComment(selectedPostDetail.id, commentText);
    if (created) {
      setCommentText("");
    }
    setSubmittingComment(false);
  };

  const handleReply = (username) => {
    setCommentText(`@${username} `);
    commentInputRef.current?.focus();
  };

  const isVideo = selectedPostDetail.mediaType === "video";

  return (
    <div
      className="modal-overlay post-detail-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="post-detail-close-btn"
        onClick={handleClose}
        aria-label="Close modal"
      >
        <X size={26} strokeWidth={2.2} />
      </button>

      <div
        className="modal-container post-detail-modal"
        onClick={(e) => e.stopPropagation()}
        style={modalDims ? { width: modalDims.width, height: modalDims.height } : undefined}
      >
        {/* Left Column: Media Panel */}
        <div
          className="post-detail-media"
          style={modalDims?.mediaWidth ? { width: modalDims.mediaWidth, flex: `0 0 ${modalDims.mediaWidth}` } : undefined}
        >
          {isVideo ? (
            <video
              src={selectedPostDetail.mediaUrl}
              controls
              playsInline
              className="post-detail-img"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <img
              src={selectedPostDetail.mediaUrl}
              alt={selectedPostDetail.caption || "Post detail"}
              className="post-detail-img"
            />
          )}
        </div>

        {/* Right Column: Post Details Panel */}
        <div className="post-detail-sidebar">
          {/* 1. Header */}
          <div className="post-detail-header">
            <div className="post-detail-header-left">
              <Link
                to={`/profile/${selectedPostDetail.author.username}`}
                className="post-detail-avatar-link"
                onClick={handleClose}
                title={selectedPostDetail.author.username}
              >
                <img
                  src={selectedPostDetail.author.avatar}
                  alt={selectedPostDetail.author.username}
                  className="post-detail-author-avatar"
                />
              </Link>
              <div className="post-detail-header-meta">
                <div className="post-detail-author-name-row">
                  <Link
                    to={`/profile/${selectedPostDetail.author.username}`}
                    className="post-detail-username"
                    onClick={handleClose}
                  >
                    {selectedPostDetail.author.username}
                  </Link>
                  {selectedPostDetail.author.isVerified && (
                    <CheckCircle2
                      size={13}
                      className="verified-badge"
                      fill="currentColor"
                    />
                  )}
                </div>
                {selectedPostDetail.location && (
                  <span className="post-detail-location">
                    {selectedPostDetail.location}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="post-detail-more-btn"
              onClick={() => setMoreOptionsPost(selectedPostDetail)}
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>

          {/* 2. Scrollable Comments Section */}
          <CommentsSection
            post={selectedPostDetail}
            onReply={handleReply}
            onCloseModal={handleClose}
          />

          {/* 3. Fixed Footer: Actions & Likes Section */}
          <div className="post-detail-footer">
            <div className="post-detail-actions-section">
              <div className="post-detail-actions-row">
                <div className="post-detail-actions-left">
                  <button
                    type="button"
                    className={`post-action-btn ${selectedPostDetail.isLiked ? "liked" : ""}`}
                    onClick={() => toggleLikePost(selectedPostDetail.id)}
                    title={selectedPostDetail.isLiked ? "Unlike" : "Like"}
                    aria-label={selectedPostDetail.isLiked ? "Unlike post" : "Like post"}
                  >
                    <Heart
                      size={24}
                      fill={selectedPostDetail.isLiked ? "var(--accent-red)" : "none"}
                      stroke={selectedPostDetail.isLiked ? "var(--accent-red)" : "currentColor"}
                    />
                  </button>
                  <button
                    type="button"
                    className="post-action-btn"
                    onClick={() => commentInputRef.current?.focus()}
                    title="Comment"
                    aria-label="Comment on post"
                  >
                    <MessageCircle size={24} />
                  </button>
                  <ShareButton post={selectedPostDetail} />
                </div>
                <button
                  type="button"
                  className="post-action-btn"
                  onClick={() => toggleSavePost(selectedPostDetail.id)}
                  title={selectedPostDetail.isSaved ? "Saved" : "Save"}
                  aria-label={selectedPostDetail.isSaved ? "Unsave post" : "Save post"}
                >
                  <Bookmark
                    size={24}
                    fill={selectedPostDetail.isSaved ? "currentColor" : "none"}
                  />
                </button>
              </div>

              <div className="post-detail-likes-count">
                {(selectedPostDetail.likesCount || 0).toLocaleString()}{" "}
                {(selectedPostDetail.likesCount || 0) === 1 ? "like" : "likes"}
              </div>
              <div className="post-detail-timestamp">
                {formatRelativeTime(selectedPostDetail.createdAt)}
              </div>
            </div>

            {/* Comment Composer */}
            <form className="post-detail-comment-form" onSubmit={handleAddComment}>
              <button
                type="button"
                className="post-detail-emoji-btn"
                title="Insert emoji"
                aria-label="Insert emoji"
                onClick={() => {
                  setCommentText((prev) => (prev ? prev + " 😊" : "😊 "));
                  commentInputRef.current?.focus();
                }}
              >
                <Smile size={24} strokeWidth={1.8} />
              </button>
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Add a comment..."
                className="post-detail-comment-input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={submittingComment}
              />
              <button
                type="submit"
                className="post-detail-comment-submit"
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? "..." : "Post"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
