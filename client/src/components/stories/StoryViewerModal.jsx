import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Eye,
  Trash2,
  AlertCircle
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import storyService from "../../services/storyService";
import { formatRelativeTime } from "../../utils/formatTime";
import { optimizeMediaUrl, isVideoMedia, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";

export default function StoryViewerModal() {
  const {
    currentUser,
    stories,
    activeStoryIndex,
    setActiveStoryIndex,
    markStoryViewed,
    deleteStoryById
  } = useApp();

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Story Viewers drawer (owner only)
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const videoRef = useRef(null);
  const viewedIdsRef = useRef(new Set());
  const pressStartTimeRef = useRef(0);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const holdPausedRef = useRef(false);

  const activeUserStory =
    activeStoryIndex !== null && stories[activeStoryIndex] ? stories[activeStoryIndex] : null;
  const activeSlides = activeUserStory?.stories || [];
  const currentSlide = activeSlides[currentSlideIndex] || activeSlides[0] || null;
  const isVideo = Boolean(currentSlide && isVideoMedia(currentSlide.mediaUrl, currentSlide.mediaType));
  const isOwnStory = Boolean(
    activeUserStory &&
      currentUser &&
      (activeUserStory.isOwn ||
        activeUserStory.userId === currentUser.id ||
        activeUserStory.username === currentUser.username)
  );

  // Close handler
  const handleClose = useCallback(() => {
    setActiveStoryIndex(null);
    setCurrentSlideIndex(0);
    setProgress(0);
    setIsPaused(false);
    setShowViewersDrawer(false);
    setViewersList([]);
  }, [setActiveStoryIndex]);

  // Move to next slide or next user's story group
  const handleNext = useCallback(() => {
    if (!activeUserStory) return;
    setShowViewersDrawer(false);

    if (currentSlideIndex < activeSlides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
      setProgress(0);
      setIsMediaLoading(true);
      setMediaError(false);
    } else if (activeStoryIndex < stories.length - 1) {
      const nextGroup = stories[activeStoryIndex + 1];
      const firstUnseenIdx = nextGroup?.stories?.findIndex((s) => !s.isViewed) ?? 0;
      setActiveStoryIndex(activeStoryIndex + 1);
      setCurrentSlideIndex(firstUnseenIdx >= 0 ? firstUnseenIdx : 0);
      setProgress(0);
      setIsMediaLoading(true);
      setMediaError(false);
    } else {
      handleClose();
    }
  }, [activeUserStory, activeSlides.length, activeStoryIndex, currentSlideIndex, stories, setActiveStoryIndex, handleClose]);

  // Move to previous slide or previous user's story group
  const handlePrev = useCallback(() => {
    if (!activeUserStory) return;
    setShowViewersDrawer(false);

    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
      setProgress(0);
      setIsMediaLoading(true);
      setMediaError(false);
    } else if (activeStoryIndex > 0) {
      const prevGroup = stories[activeStoryIndex - 1];
      const lastIdx = Math.max(0, (prevGroup?.stories?.length || 1) - 1);
      setActiveStoryIndex(activeStoryIndex - 1);
      setCurrentSlideIndex(lastIdx);
      setProgress(0);
      setIsMediaLoading(true);
      setMediaError(false);
    } else {
      setProgress(0);
    }
  }, [activeUserStory, activeStoryIndex, currentSlideIndex, stories, setActiveStoryIndex]);

  // Reset slide selection cleanly when opening a new user group
  useEffect(() => {
    if (activeStoryIndex === null) return;
    const group = stories[activeStoryIndex];
    if (!group || !group.stories || group.stories.length === 0) {
      handleClose();
      return;
    }
    const firstUnseen = group.stories.findIndex((s) => !s.isViewed);
    setCurrentSlideIndex(firstUnseen >= 0 ? firstUnseen : 0);
    setProgress(0);
    setIsPaused(false);
    setShowViewersDrawer(false);
    setIsMediaLoading(true);
    setMediaError(false);
    // Only reset slide index when switching to a different user group index
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoryIndex]);

  // Lock background page scroll while viewer is open
  useEffect(() => {
    if (activeStoryIndex === null) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeStoryIndex]);

  // Record a unique view in MongoDB ONLY when a specific story slide is actually displayed
  useEffect(() => {
    if (activeStoryIndex === null || !currentSlide?.id) return;

    const slideId = currentSlide.id;
    markStoryViewed(slideId);

    if (!viewedIdsRef.current.has(slideId)) {
      viewedIdsRef.current.add(slideId);
      storyService.recordStoryView(slideId).catch((err) => {
        console.error("[Stories] Failed to record view:", err.message);
      });
    }
  }, [activeStoryIndex, currentSlide?.id, markStoryViewed]);

  // Pause/resume video element cleanly
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo) return;

    const shouldPause = isPaused || showViewersDrawer || isDeleting;
    if (shouldPause) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [isPaused, showViewersDrawer, isDeleting, isVideo, currentSlide?.id]);

  // Auto progression timer for image stories (videos advance via onTimeUpdate/onEnded)
  useEffect(() => {
    if (
      activeStoryIndex === null ||
      !currentSlide ||
      isVideo ||
      isPaused ||
      showViewersDrawer ||
      isMediaLoading ||
      mediaError ||
      isDeleting
    ) {
      return;
    }

    const interval = setInterval(() => {
      setProgress((oldProgress) => (oldProgress >= 100 ? 100 : oldProgress + 2)); // 5 seconds total (100ms * 50 ticks)
    }, 100);

    return () => clearInterval(interval);
  }, [
    activeStoryIndex,
    currentSlide,
    isVideo,
    isPaused,
    showViewersDrawer,
    isMediaLoading,
    mediaError,
    isDeleting
  ]);

  // Advance to next slide outside setProgress updater to avoid cross-component render updates
  useEffect(() => {
    if (activeStoryIndex !== null && !isVideo && progress >= 100) {
      handleNext();
    }
  }, [activeStoryIndex, isVideo, progress, handleNext]);

  // Keyboard navigation (Escape, Left, Right, Space)
  useEffect(() => {
    if (activeStoryIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showViewersDrawer) {
          setShowViewersDrawer(false);
        } else {
          handleClose();
        }
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStoryIndex, showViewersDrawer, handleClose, handleNext, handlePrev]);

  const handleOpenViewers = async (e) => {
    e.stopPropagation();
    if (!currentSlide?.id || !isOwnStory) return;
    setShowViewersDrawer(true);
    setViewersLoading(true);
    try {
      const res = await storyService.getStoryViewers(currentSlide.id);
      setViewersList(res.viewers || []);
    } catch (err) {
      console.error("[Stories] Failed to fetch viewers:", err.message);
      setViewersList([]);
    } finally {
      setViewersLoading(false);
    }
  };

  const handleDeleteCurrentStory = async (e) => {
    e.stopPropagation();
    if (!currentSlide?.id || !isOwnStory || isDeleting) return;

    setIsDeleting(true);
    const totalSlidesBefore = activeSlides.length;
    const ok = await deleteStoryById(currentSlide.id);
    setIsDeleting(false);

    if (ok) {
      if (totalSlidesBefore <= 1) {
        if (stories.length <= 1) {
          handleClose();
        } else {
          setActiveStoryIndex((prev) =>
            prev !== null ? Math.min(prev, stories.length - 2) : null
          );
          setCurrentSlideIndex(0);
          setProgress(0);
        }
      } else {
        setCurrentSlideIndex((prev) => Math.min(prev, totalSlidesBefore - 2));
        setProgress(0);
      }
    }
  };

  // Press-and-hold vs Tap Left/Right navigation inside media container
  const handleMediaPointerDown = (e) => {
    pressStartTimeRef.current = Date.now();
    holdPausedRef.current = false;
    setIsPaused(true);
    if ("touches" in e && e.touches[0]) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleMediaPointerUp = (e) => {
    setIsPaused(false);
    if (showViewersDrawer) return;

    // Handle touch swipe gestures on mobile
    if ("changedTouches" in e && e.changedTouches[0]) {
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
        return;
      }
      if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        handleClose();
        return;
      }
    }

    const elapsed = Date.now() - pressStartTimeRef.current;
    if (elapsed > 250) {
      // Long press released -> resume playback without skipping
      return;
    }

    // Short tap: left 35% goes backward, right 65% advances forward
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX =
      "changedTouches" in e && e.changedTouches[0]
        ? e.changedTouches[0].clientX
        : e.clientX;
    const relativeX = clientX - rect.left;

    if (relativeX < rect.width * 0.35) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  if (activeStoryIndex === null || !activeUserStory || !currentSlide) return null;

  const avatarSrc =
    optimizeMediaUrl(activeUserStory.userAvatar, { width: 150, isAvatar: true }) ||
    getAvatarFallbackUrl(activeUserStory.username);
  const mediaSrc = optimizeMediaUrl(currentSlide.mediaUrl, { width: 1080 });

  const hasPrev = activeStoryIndex > 0 || currentSlideIndex > 0;
  const hasNext =
    activeStoryIndex < stories.length - 1 || currentSlideIndex < activeSlides.length - 1;

  return (
    <div
      className="story-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${activeUserStory.username}'s story`}
      onClick={handleClose}
    >
      <button
        type="button"
        className="story-viewer-close-btn"
        onClick={handleClose}
        aria-label="Close stories"
      >
        <X size={28} />
      </button>

      {/* Main Story Stage (wrapper avoids clipping external nav arrows) */}
      <div
        className="story-viewer-stage"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Desktop Prev / Next Navigation Arrows */}
        {hasPrev && (
          <button
            type="button"
            className="story-nav-btn story-nav-prev"
            onClick={handlePrev}
            aria-label="Previous story"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            className="story-nav-btn story-nav-next"
            onClick={handleNext}
            aria-label="Next story"
          >
            <ChevronRight size={24} />
          </button>
        )}

        <div className="story-viewer-content">

        {/* Segmented Progress Bars */}
        <div className="story-progress-bar-container">
          {activeSlides.map((slide, sIdx) => {
            let fillWidth = "0%";
            if (sIdx < currentSlideIndex) fillWidth = "100%";
            else if (sIdx === currentSlideIndex) fillWidth = `${Math.min(100, Math.max(0, progress))}%`;

            return (
              <div key={slide.id || sIdx} className="story-progress-segment">
                <div
                  className="story-progress-fill"
                  style={{ width: fillWidth }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header */}
        <div className="story-viewer-header" onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/profile/${activeUserStory.username}`}
            onClick={handleClose}
            className="story-viewer-user-info"
            style={{ textDecoration: "none" }}
          >
            <img
              src={avatarSrc}
              alt={activeUserStory.username}
              className="story-viewer-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getAvatarFallbackUrl(activeUserStory.username);
              }}
            />
            <span className="story-viewer-username">{activeUserStory.username}</span>
            <span className="story-viewer-time">
              {currentSlide.createdAt ? formatRelativeTime(currentSlide.createdAt) : "Just now"}
            </span>
          </Link>

          {/* Playback & Owner Controls */}
          <div className="story-viewer-controls">
            <button
              type="button"
              className="story-header-icon-btn"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? "Play story" : "Pause story"}
              title={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>

            {isVideo && (
              <button
                type="button"
                className="story-header-icon-btn"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}

            {isOwnStory && (
              <button
                type="button"
                className="story-header-icon-btn"
                onClick={handleDeleteCurrentStory}
                disabled={isDeleting}
                aria-label="Delete story"
                title="Delete story"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Story Media Container (Tap Left/Right + Swipe + Hold to Pause) */}
        <div
          className="story-viewer-media-container"
          onMouseDown={handleMediaPointerDown}
          onMouseUp={handleMediaPointerUp}
          onTouchStart={handleMediaPointerDown}
          onTouchEnd={handleMediaPointerUp}
        >
          {isMediaLoading && !mediaError && (
            <div className="story-media-loading-overlay">
              <div className="story-media-spinner" />
            </div>
          )}

          {mediaError ? (
            <div className="story-media-error-overlay">
              <AlertCircle size={34} />
              <p>Story media could not be loaded.</p>
            </div>
          ) : isVideo ? (
            <video
              key={currentSlide.id}
              ref={videoRef}
              src={mediaSrc}
              autoPlay
              playsInline
              muted={isMuted}
              className="story-viewer-img"
              style={{ objectFit: "contain", backgroundColor: "#000" }}
              onLoadedData={() => {
                setIsMediaLoading(false);
                setMediaError(false);
              }}
              onTimeUpdate={(e) => {
                const vid = e.currentTarget;
                if (vid.duration && Number.isFinite(vid.duration)) {
                  setProgress((vid.currentTime / vid.duration) * 100);
                }
              }}
              onEnded={handleNext}
              onError={() => {
                setIsMediaLoading(false);
                setMediaError(true);
              }}
            />
          ) : (
            <img
              key={currentSlide.id}
              src={mediaSrc}
              alt={currentSlide.caption || `${activeUserStory.username}'s story`}
              className="story-viewer-img"
              onLoad={() => {
                setIsMediaLoading(false);
                setMediaError(false);
              }}
              onError={() => {
                setIsMediaLoading(false);
                setMediaError(true);
              }}
            />
          )}

          {currentSlide.caption && !showViewersDrawer && (
            <div
              className="story-viewer-caption"
              style={isOwnStory ? { bottom: "56px" } : undefined}
            >
              {currentSlide.caption}
            </div>
          )}
        </div>

        {/* Owner Viewers Trigger Bar */}
        {isOwnStory && !showViewersDrawer && (
          <button
            type="button"
            className="story-viewers-trigger"
            onClick={handleOpenViewers}
          >
            <Eye size={16} />
            <span>
              {typeof currentSlide.viewersCount === "number"
                ? `${currentSlide.viewersCount} ${currentSlide.viewersCount === 1 ? "viewer" : "viewers"}`
                : "Viewers"}
            </span>
          </button>
        )}

        {/* Owner Viewers Sheet Drawer */}
        {isOwnStory && showViewersDrawer && (
          <div
            className="story-viewers-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="story-viewers-drawer-header">
              <span>Viewers ({viewersList.length})</span>
              <button
                type="button"
                onClick={() => setShowViewersDrawer(false)}
                aria-label="Close viewers list"
                style={{ color: "var(--text-primary)", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="story-viewers-drawer-body">
              {viewersLoading ? (
                <div className="story-viewers-empty">Loading viewers...</div>
              ) : viewersList.length === 0 ? (
                <div className="story-viewers-empty">No viewers yet.</div>
              ) : (
                viewersList.map((viewer) => (
                  <Link
                    key={viewer.id}
                    to={`/profile/${viewer.username}`}
                    onClick={handleClose}
                    className="story-viewer-row"
                  >
                    <img
                      src={
                        optimizeMediaUrl(viewer.avatar, { width: 100, isAvatar: true }) ||
                        getAvatarFallbackUrl(viewer.username)
                      }
                      alt={viewer.username}
                      className="story-viewer-row-avatar"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getAvatarFallbackUrl(viewer.username);
                      }}
                    />
                    <div className="story-viewer-row-meta">
                      <span className="story-viewer-row-username">{viewer.username}</span>
                      <span className="story-viewer-row-fullname">{viewer.fullName}</span>
                    </div>
                    <span className="story-viewer-row-time">
                      {viewer.viewedAt ? formatRelativeTime(viewer.viewedAt) : ""}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
