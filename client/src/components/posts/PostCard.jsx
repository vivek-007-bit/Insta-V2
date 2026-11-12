import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Bookmark,
  CheckCircle2
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { formatRelativeTime } from "../../utils/formatTime";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";
import MediaRenderer from "../shared/MediaRenderer";
import ShareButton from "./ShareButton";

export function PostHeader({ post, onMoreClick }) {
  const profileLink = `/profile/${post.author.username}`;
  const avatarSrc = optimizeMediaUrl(post.author?.avatar, {
    width: 150,
    isAvatar: true
  }) || getAvatarFallbackUrl(post.author?.username);

  return (
    <div className="post-header">
      <div className="post-header-left">
        <Link to={profileLink} className="post-author-avatar-wrap">
          <img
            src={avatarSrc}
            alt={post.author.username}
            className="post-author-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = getAvatarFallbackUrl(post.author?.username);
            }}
          />
        </Link>
        <div className="post-header-meta">
          <div className="post-author-name-row">
            <Link to={profileLink} className="post-author-username">
              {post.author.username}
            </Link>
            {post.author.isVerified && (
              <CheckCircle2 size={13} className="verified-badge" fill="currentColor" />
            )}
            <span className="post-header-dot">•</span>
            <span className="post-header-time">{formatRelativeTime(post.createdAt)}</span>
          </div>
          {post.location && <span className="post-location">{post.location}</span>}
        </div>
      </div>
      <button
        className="post-header-more-btn"
        onClick={() => onMoreClick(post)}
        aria-label="More options"
      >
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}

export function PostMedia({ post, onDoubleClick }) {
  const [showHeart, setShowHeart] = useState(false);

  const handleDoubleClick = () => {
    setShowHeart(true);
    onDoubleClick(post.id);
    setTimeout(() => {
      setShowHeart(false);
    }, 800);
  };

  // Aspect ratio class mapping
  const aspectClass =
    post.mediaAspect === "portrait"
      ? "post-media-aspect-portrait"
      : post.mediaAspect === "landscape"
      ? "post-media-aspect-landscape"
      : "post-media-aspect-square";

  return (
    <div
      className={`post-media-container ${aspectClass}`}
      onDoubleClick={handleDoubleClick}
      title="Double click to like"
    >
      <MediaRenderer
        src={post.mediaUrl}
        mediaType={post.mediaType}
        alt={post.caption || "Post media"}
        variant="feed"
        className="post-media-img"
      />
      {showHeart && (
        <div className="post-heart-animation" style={{ zIndex: 5 }}>
          <Heart size={90} fill="#ffffff" stroke="#ffffff" />
        </div>
      )}
    </div>
  );
}

export function PostActions({ post, onLike, onComment, onSave }) {
  return (
    <div className="post-actions-row">
      <div className="post-actions-left">
        <button
          className={`post-action-btn ${post.isLiked ? "liked" : ""}`}
          onClick={() => onLike(post.id)}
          aria-label={post.isLiked ? "Unlike post" : "Like post"}
        >
          <Heart
            size={24}
            fill={post.isLiked ? "var(--accent-red)" : "none"}
            stroke={post.isLiked ? "var(--accent-red)" : "currentColor"}
          />
        </button>

        <button
          className="post-action-btn"
          onClick={() => onComment(post)}
          aria-label="Comment on post"
        >
          <MessageCircle size={24} />
        </button>

        <ShareButton post={post} />
      </div>

      <button
        className="post-action-btn"
        onClick={() => onSave(post.id)}
        aria-label={post.isSaved ? "Remove from saved" : "Save post"}
      >
        <Bookmark
          size={24}
          fill={post.isSaved ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

export function PostCaption({ post }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = post.caption && post.caption.length > 90;

  return (
    <div className="post-caption-block">
      <Link to={`/profile/${post.author.username}`} className="post-caption-author">
        {post.author.username}
      </Link>
      <span>
        {isLong && !isExpanded ? `${post.caption.slice(0, 90)}...` : post.caption}
      </span>
      {isLong && !isExpanded && (
        <button
          className="post-caption-more"
          onClick={() => setIsExpanded(true)}
        >
          more
        </button>
      )}
    </div>
  );
}

export function CommentsPreview({ post, onOpenDetail }) {
  const previewComments = post.comments || [];
  const totalCount =
    typeof post.commentsCount === "number"
      ? post.commentsCount
      : previewComments.length;

  if (totalCount === 0 && previewComments.length === 0) return null;

  return (
    <div>
      {totalCount > 1 && (
        <button
          className="post-view-comments-btn"
          onClick={() => onOpenDetail(post)}
        >
          View all {totalCount} comments
        </button>
      )}
      {previewComments.slice(-2).map((comm) => (
        <div key={comm.id} className="post-caption-block" style={{ marginTop: "2px" }}>
          <Link to={`/profile/${comm.username}`} className="post-caption-author">
            {comm.username}
          </Link>
          <span>{comm.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function PostCard({ post }) {
  const {
    toggleLikePost,
    doubleClickLikePost,
    toggleSavePost,
    setSelectedPostDetail,
    setMoreOptionsPost,
    addComment
  } = useApp();

  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || submittingComment) return;
    setSubmittingComment(true);
    const created = await addComment(post.id, commentInput);
    if (created) {
      setCommentInput("");
    }
    setSubmittingComment(false);
  };

  return (
    <article className="post-card">
      <PostHeader
        post={post}
        onMoreClick={(p) => setMoreOptionsPost(p)}
      />

      <PostMedia
        post={post}
        onDoubleClick={(postId) => doubleClickLikePost(postId)}
      />

      <PostActions
        post={post}
        onLike={(id) => toggleLikePost(id)}
        onComment={(p) => setSelectedPostDetail(p)}
        onSave={(id) => toggleSavePost(id)}
      />

      <div className="post-details">
        <div className="post-likes-count">
          {(post.likesCount || 0).toLocaleString()}{" "}
          {(post.likesCount || 0) === 1 ? "like" : "likes"}
        </div>

        {post.caption && <PostCaption post={post} />}

        <CommentsPreview
          post={post}
          onOpenDetail={(p) => setSelectedPostDetail(p)}
        />

        <div className="post-timestamp">{formatRelativeTime(post.createdAt)}</div>
      </div>

      <form className="post-add-comment-row" onSubmit={handleAddComment}>
        <input
          type="text"
          placeholder="Add a comment..."
          className="post-comment-input"
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          disabled={submittingComment}
        />
        <button
          type="submit"
          className="post-comment-submit"
          disabled={!commentInput.trim() || submittingComment}
        >
          {submittingComment ? "..." : "Post"}
        </button>
      </form>
    </article>
  );
}
