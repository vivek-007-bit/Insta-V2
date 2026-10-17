import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  CheckCircle2,
  Smile
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { SUGGESTED_USERS } from "../../data/demoData";

export default function PostDetailModal() {
  const {
    selectedPostDetail,
    setSelectedPostDetail,
    toggleLikePost,
    toggleSavePost,
    setShareDialogPost,
    setMoreOptionsPost,
    addComment,
    currentUser
  } = useApp();

  const [commentText, setCommentText] = useState("");
  const [modalDims, setModalDims] = useState(null);
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

      // On mobile / small tablet, responsive CSS handles layout
      if (vw <= 768) {
        if (isMounted) setModalDims(null);
        return;
      }

      const maxModalHeight = Math.min(vh - 64, 850);
      const minModalHeight = 480;
      const detailsWidth = 410; // Fixed target width for details panel

      let modalHeight;
      let mediaWidth;

      if (naturalAspect <= 0.82) {
        // Portrait (e.g. 4:5 = 0.8)
        modalHeight = maxModalHeight;
        mediaWidth = Math.min(modalHeight * naturalAspect, 640);
      } else if (naturalAspect <= 1.05) {
        // Square (1:1)
        modalHeight = Math.min(maxModalHeight, 720);
        mediaWidth = modalHeight;
      } else if (naturalAspect <= 1.5) {
        // Mild landscape (4:3)
        modalHeight = Math.max(minModalHeight, Math.min(maxModalHeight, 620 / naturalAspect));
        mediaWidth = modalHeight * naturalAspect;
      } else {
        // Wide landscape (16:9, etc.)
        modalHeight = Math.max(minModalHeight, Math.min(maxModalHeight, 520));
        mediaWidth = Math.min(modalHeight * naturalAspect, 680);
      }

      // Ensure media width never pushes the right panel beyond viewport
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

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(selectedPostDetail.id, commentText);
    setCommentText("");
  };

  const handleReply = (username) => {
    setCommentText(`@${username} `);
    commentInputRef.current?.focus();
  };

  const getCommentAvatar = (username) => {
    if (username === currentUser?.username) return currentUser.avatar;
    const match = SUGGESTED_USERS.find((u) => u.username === username);
    if (match) return match.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=262626&color=ffffff&size=100`;
  };

  return (
    <div
      className="modal-overlay post-detail-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Outside close button in top-right of viewport */}
      <button
        type="button"
        className="post-detail-close-btn"
        onClick={handleClose}
        aria-label="Close modal"
      >
        <X size={26} strokeWidth={2.2} />
      </button>

      {/* Main Two-Column Modal Container */}
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
          <img
            src={selectedPostDetail.mediaUrl}
            alt={selectedPostDetail.caption || "Post detail"}
            className="post-detail-img"
          />
        </div>

        {/* Right Column: Post Details Panel */}
        <div className="post-detail-sidebar">
          {/* 1. Compact Post Header */}
          <div className="post-detail-header">
            <div className="post-detail-header-left">
              <Link
                to="/profile"
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
                    to="/profile"
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

          {/* 2. Independently Scrollable Comments Region */}
          <div className="post-detail-comments-list">
            {/* Original caption as first item with author avatar */}
            {selectedPostDetail.caption && (
              <div className="post-detail-comment-item">
                <Link
                  to="/profile"
                  className="post-detail-comment-avatar-link"
                  onClick={handleClose}
                  title={selectedPostDetail.author.username}
                >
                  <img
                    src={selectedPostDetail.author.avatar}
                    alt={selectedPostDetail.author.username}
                    className="post-detail-comment-avatar"
                  />
                </Link>
                <div className="post-detail-comment-body">
                  <div className="post-detail-comment-text-wrap">
                    <Link
                      to="/profile"
                      className="post-detail-comment-user"
                      onClick={handleClose}
                    >
                      {selectedPostDetail.author.username}
                    </Link>
                    {selectedPostDetail.author.isVerified && (
                      <CheckCircle2
                        size={12}
                        className="verified-badge inline-verified"
                        fill="currentColor"
                      />
                    )}
                    <span className="post-detail-comment-content">
                      {selectedPostDetail.caption}
                    </span>
                  </div>
                  <div className="post-detail-comment-meta">
                    <span className="post-detail-comment-time">{selectedPostDetail.createdAt}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Comments List */}
            {selectedPostDetail.comments?.map((comm) => (
              <div key={comm.id} className="post-detail-comment-item">
                <Link
                  to="/profile"
                  className="post-detail-comment-avatar-link"
                  onClick={handleClose}
                  title={comm.username}
                >
                  <img
                    src={getCommentAvatar(comm.username)}
                    alt={comm.username}
                    className="post-detail-comment-avatar"
                  />
                </Link>
                <div className="post-detail-comment-body">
                  <div className="post-detail-comment-text-wrap">
                    <Link
                      to="/profile"
                      className="post-detail-comment-user"
                      onClick={handleClose}
                    >
                      {comm.username}
                    </Link>
                    <span className="post-detail-comment-content">{comm.text}</span>
                  </div>
                  <div className="post-detail-comment-meta">
                    <span className="post-detail-comment-time">{comm.createdAt}</span>
                    {comm.likesCount > 0 && (
                      <span className="post-detail-comment-likes">
                        {comm.likesCount} {comm.likesCount === 1 ? "like" : "likes"}
                      </span>
                    )}
                    <button
                      type="button"
                      className="post-detail-comment-reply-btn"
                      onClick={() => handleReply(comm.username)}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 3 & 4. Fixed Footer: Actions & Likes Section + Comment Composer */}
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
                  <button
                    type="button"
                    className="post-action-btn"
                    onClick={() => setShareDialogPost(selectedPostDetail)}
                    title="Share"
                    aria-label="Share post"
                  >
                    <Send size={24} />
                  </button>
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
                {selectedPostDetail.likesCount.toLocaleString()}{" "}
                {selectedPostDetail.likesCount === 1 ? "like" : "likes"}
              </div>
              <div className="post-detail-timestamp">
                {selectedPostDetail.createdAt}
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
              />
              <button
                type="submit"
                className="post-detail-comment-submit"
                disabled={!commentText.trim()}
              >
                Post
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
