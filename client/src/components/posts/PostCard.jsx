import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  CheckCircle2
} from "lucide-react";
import { useApp } from "../../context/AppContext";

export function PostHeader({ post, onMoreClick }) {
  return (
    <div className="post-header">
      <div className="post-header-left">
        <Link to="/profile" className="post-author-avatar-wrap">
          <img
            src={post.author.avatar}
            alt={post.author.username}
            className="post-author-avatar"
          />
        </Link>
        <div className="post-header-meta">
          <div className="post-author-name-row">
            <Link to="/profile" className="post-author-username">
              {post.author.username}
            </Link>
            {post.author.isVerified && (
              <CheckCircle2 size={13} className="verified-badge" fill="currentColor" />
            )}
            <span className="post-header-dot">•</span>
            <span className="post-header-time">{post.createdAt}</span>
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
      <img
        src={post.mediaUrl}
        alt={post.caption || "Post media"}
        className="post-media-img"
        loading="lazy"
        onError={(e) => {
          // Graceful fallback for broken image URLs
          e.target.onerror = null;
          e.target.src =
            "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&auto=format&fit=crop&q=80";
        }}
      />
      {showHeart && (
        <div className="post-heart-animation">
          <Heart size={90} fill="#ffffff" stroke="#ffffff" />
        </div>
      )}
    </div>
  );
}

export function PostActions({ post, onLike, onComment, onShare, onSave }) {
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

        <button
          className="post-action-btn"
          onClick={() => onShare(post)}
          aria-label="Share post"
        >
          <Send size={24} />
        </button>
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
      <Link to="/profile" className="post-caption-author">
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
  const commentCount = post.comments ? post.comments.length : 0;

  if (commentCount === 0) return null;

  return (
    <div>
      {commentCount > 1 && (
        <button
          className="post-view-comments-btn"
          onClick={() => onOpenDetail(post)}
        >
          View all {commentCount} comments
        </button>
      )}
      {post.comments.slice(0, 2).map(comm => (
        <div key={comm.id} className="post-caption-block" style={{ marginTop: "2px" }}>
          <span className="post-caption-author">{comm.username}</span>
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
    setShareDialogPost,
    setMoreOptionsPost,
    addComment
  } = useApp();

  const [commentInput, setCommentInput] = useState("");

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(post.id, commentInput);
    setCommentInput("");
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
        onShare={(p) => setShareDialogPost(p)}
        onSave={(id) => toggleSavePost(id)}
      />

      <div className="post-details">
        <div className="post-likes-count">
          {post.likesCount.toLocaleString()} {post.likesCount === 1 ? "like" : "likes"}
        </div>

        {post.caption && <PostCaption post={post} />}

        <CommentsPreview
          post={post}
          onOpenDetail={(p) => setSelectedPostDetail(p)}
        />

        <div className="post-timestamp">{post.createdAt}</div>
      </div>

      <form className="post-add-comment-row" onSubmit={handleAddComment}>
        <input
          type="text"
          placeholder="Add a comment..."
          className="post-comment-input"
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
        />
        <button
          type="submit"
          className="post-comment-submit"
          disabled={!commentInput.trim()}
        >
          Post
        </button>
      </form>
    </article>
  );
}
