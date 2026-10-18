import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Music,
  CheckCircle2,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Reels() {
  const { initialReels, setShareDialogPost, showToast } = useApp();
  const [reels, setReels] = useState(initialReels);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showFeedback, setShowFeedback] = useState(null); // null | "play" | "pause"
  const [expandedCaptions, setExpandedCaptions] = useState({});
  const [followingMap, setFollowingMap] = useState({});

  const scrollContainerRef = useRef(null);
  const slideRefs = useRef([]);
  const videoRefs = useRef({});
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const touchStartYRef = useRef(null);

  // Smoothly scroll the container to target slide
  const handleScrollTo = useCallback((index) => {
    if (index < 0 || index >= reels.length) return;
    setCurrentIndex(index);
    setIsPlaying(true);
    setShowFeedback(null);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);

    const targetSlide = slideRefs.current[index];
    if (targetSlide) {
      targetSlide.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 650);
  }, [reels.length]);

  // Previous and Next button handlers
  const handlePrevReel = useCallback(() => {
    if (currentIndex > 0) {
      isScrollingRef.current = true;
      handleScrollTo(currentIndex - 1);
    }
  }, [currentIndex, handleScrollTo]);

  const handleNextReel = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      isScrollingRef.current = true;
      handleScrollTo(currentIndex + 1);
    }
  }, [currentIndex, reels.length, handleScrollTo]);

  // Non-passive wheel event listener with gesture lock to prevent runaway skipping
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      // Don't intercept if user is typing in an input or textarea
      const tag = e.target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (Math.abs(e.deltaY) < 20) return;
      e.preventDefault();

      // If a transition is already underway, absorb trackpad inertia and ignore
      if (isScrollingRef.current) return;

      if (e.deltaY > 0) {
        if (currentIndex < reels.length - 1) {
          isScrollingRef.current = true;
          handleScrollTo(currentIndex + 1);
        }
      } else if (e.deltaY < 0) {
        if (currentIndex > 0) {
          isScrollingRef.current = true;
          handleScrollTo(currentIndex - 1);
        }
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [currentIndex, reels.length, handleScrollTo]);

  // Touch swipe navigation for mobile
  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartYRef.current === null) return;
    const diff = touchStartYRef.current - e.changedTouches[0].clientY;
    touchStartYRef.current = null;
    if (Math.abs(diff) > 45) {
      if (diff > 0 && currentIndex < reels.length - 1) {
        isScrollingRef.current = true;
        handleScrollTo(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        isScrollingRef.current = true;
        handleScrollTo(currentIndex - 1);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        handleNextReel();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        handlePrevReel();
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === "m") {
        e.preventDefault();
        setIsMuted((m) => !m);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNextReel, handlePrevReel]);

  // IntersectionObserver to synchronize index when scrolling natively
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const index = parseInt(entry.target.getAttribute("data-index"), 10);
            if (!isNaN(index) && index !== currentIndex) {
              setCurrentIndex(index);
              setIsPlaying(true);
              setShowFeedback(null);
              if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.55
      }
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => observer.disconnect();
  }, [currentIndex]);

  // Video playback: play only the active reel, pause and reset all others
  useEffect(() => {
    reels.forEach((reel, idx) => {
      const video = videoRefs.current[reel.id];
      if (!video) return;

      if (idx === currentIndex) {
        if (isPlaying) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Autoplay policy fallback
            });
          }
        } else {
          video.pause();
        }
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [currentIndex, isPlaying, reels]);

  // Audio mute synchronization
  useEffect(() => {
    reels.forEach((reel) => {
      const video = videoRefs.current[reel.id];
      if (video) video.muted = isMuted;
    });
  }, [isMuted, reels]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Play/pause toggle on clicking video or center control
  const togglePlay = (id) => {
    const video = videoRefs.current[id];
    if (!video) return;

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setShowFeedback("pause");
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowFeedback("play");
      feedbackTimeoutRef.current = setTimeout(() => {
        setShowFeedback(null);
      }, 700);
    }
  };

  // Like interaction
  const toggleLikeReel = (id) => {
    setReels((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const willLike = !r.isLiked;
          return {
            ...r,
            isLiked: willLike,
            likesCount: willLike ? r.likesCount + 1 : r.likesCount - 1
          };
        }
        return r;
      })
    );
  };

  // Save interaction
  const toggleSaveReel = (id) => {
    setReels((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const willSave = !r.isSaved;
          showToast(willSave ? "Saved reel to collection" : "Removed from collection");
          return { ...r, isSaved: willSave };
        }
        return r;
      })
    );
  };

  // Follow interaction
  const toggleFollowAuthor = (username) => {
    setFollowingMap((prev) => {
      const isFollowing = !!prev[username];
      showToast(isFollowing ? `Unfollowed @${username}` : `Following @${username}`);
      return { ...prev, [username]: !isFollowing };
    });
  };

  // Caption expand/collapse toggle
  const toggleCaptionExpand = (id) => {
    setExpandedCaptions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="reels-page">
      <div className="reels-stage">
        {/* Dedicated Vertically Snapping Reels Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="reels-scroll-container"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {reels.map((reel, idx) => {
            const isCaptionLong = reel.caption && reel.caption.length > 75;
            const isExpanded = !!expandedCaptions[reel.id];
            const displayCaption =
              isCaptionLong && !isExpanded
                ? `${reel.caption.slice(0, 75)}...`
                : reel.caption;
            const isCurrent = idx === currentIndex;

            return (
              <div
                key={reel.id}
                ref={(el) => (slideRefs.current[idx] = el)}
                data-index={idx}
                className={`reel-slide ${isCurrent ? "active-slide" : ""}`}
              >
                <div className="reels-stage-inner">
                  {/* 1. Centered Portrait Video Card */}
                  <div className="reel-card">
                    <video
                      ref={(el) => (videoRefs.current[reel.id] = el)}
                      src={reel.videoUrl}
                      poster={reel.posterUrl}
                      loop
                      muted={isMuted}
                      playsInline
                      className="reel-video"
                      onClick={() => togglePlay(reel.id)}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />

                    {/* Center Play/Pause Control (Instagram-Style Overlay) */}
                    {isCurrent && !isPlaying && (
                      <button
                        type="button"
                        className="reel-center-control play-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay(reel.id);
                        }}
                        aria-label="Play reel"
                        title="Play reel"
                      >
                        <Play size={36} fill="#ffffff" color="#ffffff" />
                      </button>
                    )}

                    {/* Temporary playback indicator animation (Play on resume, Pause on pause) */}
                    {isCurrent && showFeedback && (
                      <div
                        className={`reel-center-control temporary ${showFeedback === "play" ? "play-icon" : ""}`}
                        aria-hidden="true"
                      >
                        {showFeedback === "play" ? (
                          <Play size={36} fill="#ffffff" color="#ffffff" />
                        ) : (
                          <Pause size={36} fill="#ffffff" color="#ffffff" />
                        )}
                      </div>
                    )}

                    {/* Audio Mute/Unmute in upper-right */}
                    <button
                      type="button"
                      className="reel-mute-btn"
                      onClick={() => setIsMuted((m) => !m)}
                      title={isMuted ? "Unmute audio" : "Mute audio"}
                      aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>

                    {/* Creator Information & Caption in lower-left */}
                    <div className="reel-meta-overlay">
                      <div className="reel-creator-row">
                        <Link
                          to="/profile"
                          className="reel-creator-avatar-link"
                          title={reel.author.username}
                        >
                          <img
                            src={reel.author.avatar}
                            alt={reel.author.username}
                            className="reel-creator-avatar"
                          />
                        </Link>
                        <Link to="/profile" className="reel-creator-name">
                          {reel.author.username}
                        </Link>
                        {reel.author.isVerified && (
                          <CheckCircle2
                            size={14}
                            fill="currentColor"
                            color="var(--accent-blue)"
                          />
                        )}
                        <button
                          type="button"
                          className={`reel-follow-btn ${
                            followingMap[reel.author.username] ? "following" : ""
                          }`}
                          onClick={() => toggleFollowAuthor(reel.author.username)}
                        >
                          {followingMap[reel.author.username] ? "Following" : "Follow"}
                        </button>
                      </div>

                      {/* Caption */}
                      <p className="reel-caption-wrap">
                        {displayCaption}
                        {isCaptionLong && !isExpanded && (
                          <button
                            type="button"
                            className="reel-caption-more"
                            onClick={() => toggleCaptionExpand(reel.id)}
                          >
                            more
                          </button>
                        )}
                      </p>

                      {/* Audio Attribution */}
                      {reel.audioTrack && (
                        <div className="reel-audio-row">
                          <Music size={12} />
                          <span className="reel-audio-title">{reel.audioTrack}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Engagement Rail (aligned to right of this reel) */}
                  <div className="reel-actions-rail">
                    {/* Like */}
                    <div className="reel-action-group">
                      <button
                        type="button"
                        className={`reel-action-btn ${reel.isLiked ? "liked" : ""}`}
                        onClick={() => toggleLikeReel(reel.id)}
                        title={reel.isLiked ? "Unlike" : "Like"}
                        aria-label="Like reel"
                      >
                        <Heart
                          size={26}
                          fill={reel.isLiked ? "var(--accent-red)" : "none"}
                          stroke={reel.isLiked ? "var(--accent-red)" : "currentColor"}
                        />
                      </button>
                      <span className="reel-action-count">
                        {reel.likesCount.toLocaleString()}
                      </span>
                    </div>

                    {/* Comment */}
                    <div className="reel-action-group">
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() =>
                          showToast(`Comments for @${reel.author.username}'s reel`)
                        }
                        title="Comment"
                        aria-label="Comments"
                      >
                        <MessageCircle size={26} />
                      </button>
                      <span className="reel-action-count">
                        {reel.commentsCount.toLocaleString()}
                      </span>
                    </div>

                    {/* Share */}
                    <div className="reel-action-group">
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() =>
                          setShareDialogPost({
                            id: reel.id,
                            title: reel.caption
                          })
                        }
                        title="Share"
                        aria-label="Share reel"
                      >
                        <Send size={26} />
                      </button>
                      <span className="reel-action-count">
                        {reel.sharesCount.toLocaleString()}
                      </span>
                    </div>

                    {/* Save */}
                    <button
                      type="button"
                      className="reel-action-btn"
                      onClick={() => toggleSaveReel(reel.id)}
                      title={reel.isSaved ? "Saved" : "Save"}
                      aria-label={reel.isSaved ? "Remove from saved" : "Save reel"}
                    >
                      <Bookmark
                        size={26}
                        fill={reel.isSaved ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Stage Navigation Controls (Anchored to Viewport Stage on Right) */}
        <div className="reel-nav-rail">
          <button
            type="button"
            className="reel-nav-btn"
            onClick={handlePrevReel}
            disabled={currentIndex === 0}
            title="Previous reel"
            aria-label="Previous reel"
          >
            <ChevronUp size={24} />
          </button>
          <button
            type="button"
            className="reel-nav-btn"
            onClick={handleNextReel}
            disabled={currentIndex === reels.length - 1}
            title="Next reel"
            aria-label="Next reel"
          >
            <ChevronDown size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
