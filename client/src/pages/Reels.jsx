import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  ChevronDown,
  PlusSquare,
  Trash2,
  Lock,
  Film
} from "lucide-react";
import { useApp } from "../context/AppContext";
import reelService, { getOptimizedVideoUrl } from "../services/reelService";
import recommendationService from "../services/recommendationService";
import userService from "../services/userService";
import followRequestService from "../services/followRequestService";
import ReelUploadModal from "../components/modals/ReelUploadModal";
import ReelCommentsModal from "../components/reels/ReelCommentsModal";

export default function Reels() {
  const { reelId } = useParams();
  const navigate = useNavigate();
  const { currentUser, showToast, updateFollowState } = useApp();

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [accessError, setAccessError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showFeedback, setShowFeedback] = useState(null); // null | "play" | "pause"
  const [expandedCaptions, setExpandedCaptions] = useState({});
  const [videoErrors, setVideoErrors] = useState({});
  const [followLoadingMap, setFollowLoadingMap] = useState({});
  const [deletingReelId, setDeletingReelId] = useState(null);

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeCommentReel, setActiveCommentReel] = useState(null);

  const scrollContainerRef = useRef(null);
  const slideRefs = useRef([]);
  const videoRefs = useRef({});
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const touchStartYRef = useRef(null);
  const watchReportedRef = useRef({});

  // Fetch initial reels (and specific shared reel if :reelId param exists)
  const loadInitialReels = useCallback(async () => {
    setLoading(true);
    setAccessError(null);

    try {
      let targetReel = null;
      if (reelId) {
        try {
          const singleRes = await reelService.getReelById(reelId);
          targetReel = singleRes.reel;
        } catch (err) {
          setAccessError(err.message || "This reel is unavailable");
          setReels([]);
          setLoading(false);
          return;
        }
      }

      let feedList = [];
      try {
        const recRes = await recommendationService.getRecommendedReels(1, 8);
        feedList = recRes?.reels || [];
        setHasMore(Boolean(recRes?.hasMore));
        setNextCursor(null);
      } catch {
        const feedRes = await reelService.getReels(1, 6);
        feedList = feedRes?.reels || [];
        setHasMore(Boolean(feedRes?.hasMore));
        setNextCursor(feedRes?.nextCursor || null);
      }

      if (targetReel) {
        const filtered = feedList.filter((r) => r.id !== targetReel.id);
        setReels([targetReel, ...filtered]);
      } else {
        setReels(feedList);
      }

      setCurrentIndex(0);
    } catch (err) {
      showToast(err.message || "Failed to load Reels");
    } finally {
      setLoading(false);
    }
  }, [reelId, showToast]);

  useEffect(() => {
    loadInitialReels();
  }, [loadInitialReels]);

  // Infinite scroll fetch next batch
  const loadMoreReels = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      let incoming = [];
      if (nextCursor) {
        const res = await reelService.getReels(1, 6, nextCursor);
        incoming = res.reels || [];
        setHasMore(Boolean(res.hasMore));
        setNextCursor(res.nextCursor || null);
      } else {
        const page = Math.floor(reels.length / 8) + 1;
        const res = await recommendationService.getRecommendedReels(page, 8);
        incoming = res.reels || [];
        setHasMore(Boolean(res.hasMore));
      }

      setReels((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const uniqueIncoming = incoming.filter((r) => !existingIds.has(r.id));
        return [...prev, ...uniqueIncoming];
      });
    } catch (err) {
      console.error("[Reels] Pagination error:", err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextCursor, reels.length]);

  // Trigger infinite scroll when approaching end of list
  useEffect(() => {
    if (reels.length > 0 && currentIndex >= reels.length - 2 && hasMore && !loadingMore) {
      loadMoreReels();
    }
  }, [currentIndex, reels.length, hasMore, loadingMore, loadMoreReels]);

  // Smoothly scroll the container to target slide
  const handleScrollTo = useCallback(
    (index) => {
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
    },
    [reels.length]
  );

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

  // Non-passive wheel event listener with gesture lock
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (Math.abs(e.deltaY) < 20) return;
      e.preventDefault();

      if (isScrollingRef.current) return;

      if (e.deltaY > 0 && currentIndex < reels.length - 1) {
        isScrollingRef.current = true;
        handleScrollTo(currentIndex + 1);
      } else if (e.deltaY < 0 && currentIndex > 0) {
        isScrollingRef.current = true;
        handleScrollTo(currentIndex - 1);
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
      if (isUploadModalOpen || activeCommentReel) return;

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
  }, [handleNextReel, handlePrevReel, isUploadModalOpen, activeCommentReel]);

  // IntersectionObserver to pause videos leaving viewport & sync active slide
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute("data-index"), 10);
          const reel = reels[index];
          const videoEl = reel ? videoRefs.current[reel.id] : null;

          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) {
            if (videoEl && !videoEl.paused) {
              videoEl.pause();
            }
            return;
          }

          if (!isNaN(index) && index !== currentIndex) {
            setCurrentIndex(index);
            setIsPlaying(true);
            setShowFeedback(null);
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
          }
        });
      },
      {
        root: container,
        threshold: [0.1, 0.55]
      }
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => observer.disconnect();
  }, [currentIndex, reels]);

  // Play only active reel; pause and reset all others
  useEffect(() => {
    reels.forEach((reel, idx) => {
      const video = videoRefs.current[reel.id];
      if (!video) return;

      if (idx === currentIndex && !isUploadModalOpen && !activeCommentReel) {
        if (isPlaying) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        } else {
          video.pause();
        }
      } else {
        video.pause();
        if (idx !== currentIndex) {
          video.currentTime = 0;
        }
      }
    });
  }, [currentIndex, isPlaying, reels, isUploadModalOpen, activeCommentReel]);

  // Pause video when browser tab becomes hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        Object.values(videoRefs.current).forEach((v) => {
          if (v && !v.paused) v.pause();
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

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

  const togglePlay = (id) => {
    const video = videoRefs.current[id];
    if (!video) return;

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);

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

  // Real optimistic Like / Unlike with rollback on API failure
  const toggleLikeReel = async (id) => {
    const target = reels.find((r) => r.id === id);
    if (!target) return;

    const wasLiked = Boolean(target.isLiked);
    const prevCount = target.likesCount || 0;
    const nextLiked = !wasLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    const applyState = (liked, count) => {
      setReels((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, isLiked: liked, likesCount: count } : r
        )
      );
    };

    applyState(nextLiked, nextCount);

    try {
      const res = nextLiked
        ? await reelService.likeReel(id)
        : await reelService.unlikeReel(id);
      if (res && typeof res.likesCount === "number") {
        applyState(res.liked, res.likesCount);
      }
    } catch (err) {
      applyState(wasLiked, prevCount);
      showToast(err.message || "Failed to update like");
    }
  };

  // Real Share via Web Share API with Copy Link fallback
  const handleShareReel = async (reel) => {
    try {
      const res = await reelService.getShareInfo(reel.id);
      const shareUrl = res.shareUrl || `${window.location.origin}/reels/${reel.id}`;

      if (typeof res.sharesCount === "number") {
        setReels((prev) =>
          prev.map((r) =>
            r.id === reel.id ? { ...r, sharesCount: res.sharesCount } : r
          )
        );
      }

      if (navigator.share) {
        try {
          await navigator.share({
            title: res.title,
            text: res.text,
            url: shareUrl
          });
          return;
        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      showToast("Reel link copied to clipboard");
    } catch (err) {
      showToast(err.message || "Unable to share this reel");
    }
  };

  // Real Follow / Unfollow / Cancel Request on Reel creator
  const handleFollowAuthor = async (author) => {
    const authorId = author?.id || author?._id;
    if (!authorId || followLoadingMap[authorId]) return;

    setFollowLoadingMap((prev) => ({ ...prev, [authorId]: true }));

    try {
      let nextState;
      if (author.isFollowing) {
        await userService.unfollowUser(authorId);
        nextState = { isFollowing: false, isPending: false, requestId: null };
        showToast(`Unfollowed @${author.username}`);
      } else if (author.isPending && author.requestId) {
        await followRequestService.cancelRequest(author.requestId);
        nextState = { isFollowing: false, isPending: false, requestId: null };
        showToast("Follow request cancelled");
      } else {
        const res = await userService.followUser(authorId);
        nextState = {
          isFollowing: Boolean(res.isFollowing),
          isPending: Boolean(res.isPending),
          requestId: res.requestId || null
        };
        showToast(res.message || `Following @${author.username}`);
      }

      setReels((prev) =>
        prev.map((r) =>
          r.author.id === authorId
            ? { ...r, author: { ...r.author, ...nextState } }
            : r
        )
      );
      updateFollowState(authorId, nextState);
    } catch (err) {
      showToast(err.message || "Could not update follow status");
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [authorId]: false }));
    }
  };

  // Save interaction (bookmark UI)
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

  // Delete own Reel (MongoDB + Cloudinary)
  const handleDeleteReel = async (reel) => {
    if (deletingReelId) return;
    if (!window.confirm("Delete this Reel permanently?")) return;

    setDeletingReelId(reel.id);
    try {
      await reelService.deleteReel(reel.id);
      setReels((prev) => {
        const next = prev.filter((r) => r.id !== reel.id);
        if (currentIndex >= next.length && next.length > 0) {
          setCurrentIndex(next.length - 1);
        }
        return next;
      });
      showToast("Reel deleted");
    } catch (err) {
      showToast(err.message || "Failed to delete reel");
    } finally {
      setDeletingReelId(null);
    }
  };

  const toggleCaptionExpand = (id) => {
    setExpandedCaptions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleReelCreated = (newReel) => {
    if (!newReel) return;
    setReels((prev) => [newReel, ...prev]);
    setCurrentIndex(0);
    setIsPlaying(true);
    setTimeout(() => {
      slideRefs.current[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleCommentsCountChange = (targetReelId, newCount) => {
    if (typeof newCount !== "number") return;
    setReels((prev) =>
      prev.map((r) => (r.id === targetReelId ? { ...r, commentsCount: newCount } : r))
    );
    setActiveCommentReel((prev) =>
      prev && prev.id === targetReelId ? { ...prev, commentsCount: newCount } : prev
    );
  };

  const currentUserId = currentUser?.id || currentUser?._id;

  return (
    <div className="reels-page">
      {/* Subtle Top-Right Upload Reel Trigger */}
      <button
        type="button"
        onClick={() => setIsUploadModalOpen(true)}
        title="Create Reel"
        aria-label="Create Reel"
        style={{
          position: "fixed",
          top: "18px",
          right: "22px",
          zIndex: 35,
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          borderRadius: "var(--radius-full)",
          backgroundColor: "rgba(255, 255, 255, 0.14)",
          border: "1px solid rgba(255, 255, 255, 0.25)",
          color: "#ffffff",
          fontSize: "13px",
          fontWeight: "600",
          backdropFilter: "blur(10px)",
          cursor: "pointer"
        }}
      >
        <PlusSquare size={18} />
        <span>New Reel</span>
      </button>

      <div className="reels-stage">
        {loading ? (
          <div style={{ color: "#ffffff", textAlign: "center", padding: "60px 20px" }}>
            Loading Reels...
          </div>
        ) : accessError ? (
          <div
            style={{
              color: "#ffffff",
              textAlign: "center",
              padding: "48px 24px",
              maxWidth: "380px"
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto"
              }}
            >
              <Lock size={28} />
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
              Reel Unavailable
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", marginBottom: "20px" }}>
              {accessError}
            </p>
            <button
              type="button"
              onClick={() => navigate("/reels")}
              style={{
                padding: "8px 18px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-blue)",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Browse Reels
            </button>
          </div>
        ) : reels.length === 0 ? (
          <div style={{ color: "#ffffff", textAlign: "center", padding: "48px 24px", maxWidth: "380px" }}>
            <Film size={48} strokeWidth={1.4} style={{ margin: "0 auto 14px auto", opacity: 0.7 }} />
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>
              No Reels Yet
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>
              Upload a short video or follow creators to watch Reels here.
            </p>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              style={{
                padding: "9px 20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-blue)",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Upload Your First Reel
            </button>
          </div>
        ) : (
          <>
            {/* Vertically Snapping Reels Scroll Container */}
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
                const isNearViewport = Math.abs(idx - currentIndex) <= 1;
                const isOwner =
                  Boolean(reel.author?.isSelf) ||
                  (currentUserId && reel.author?.id === currentUserId);
                const hasVideoError = Boolean(videoErrors[reel.id]);

                const followLabel = reel.author?.isFollowing
                  ? "Following"
                  : reel.author?.isPending
                  ? "Requested"
                  : "Follow";

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
                        {hasVideoError ? (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "rgba(255,255,255,0.75)",
                              padding: "20px",
                              textAlign: "center",
                              backgroundColor: "#111"
                            }}
                          >
                            <Film size={36} style={{ marginBottom: "10px", opacity: 0.7 }} />
                            <p style={{ fontSize: "13px" }}>Unable to load video</p>
                          </div>
                        ) : (
                          <video
                            ref={(el) => (videoRefs.current[reel.id] = el)}
                            src={isNearViewport ? getOptimizedVideoUrl(reel.videoUrl) : undefined}
                            poster={reel.posterUrl || reel.thumbnailUrl}
                            preload={isNearViewport ? "metadata" : "none"}
                            loop
                            muted={isMuted}
                            playsInline
                            className="reel-video"
                            onClick={() => togglePlay(reel.id)}
                            onTimeUpdate={(e) => {
                              const v = e.currentTarget;
                              if (!v || !v.duration || !reel.id) return;
                              const dur = v.duration;
                              const cur = v.currentTime;
                              const rate = cur / dur;
                              if ((rate >= 0.25 || cur >= 3) && !watchReportedRef.current[reel.id]) {
                                watchReportedRef.current[reel.id] = true;
                                recommendationService.recordEvent({
                                  contentType: "reel",
                                  contentId: reel.id,
                                  eventType: "watch",
                                  watchDurationSec: Math.round(cur),
                                  completionRate: Number(rate.toFixed(2))
                                });
                              }
                            }}
                            onError={() =>
                              setVideoErrors((prev) => ({ ...prev, [reel.id]: true }))
                            }
                          />
                        )}

                        {/* Center Play/Pause Control */}
                        {isCurrent && !isPlaying && !hasVideoError && (
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

                        {/* Temporary playback indicator animation */}
                        {isCurrent && showFeedback && (
                          <div
                            className={`reel-center-control temporary ${
                              showFeedback === "play" ? "play-icon" : ""
                            }`}
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
                              to={`/profile/${reel.author.username}`}
                              className="reel-creator-avatar-link"
                              title={reel.author.username}
                            >
                              <img
                                src={reel.author.avatar}
                                alt={reel.author.username}
                                className="reel-creator-avatar"
                              />
                            </Link>
                            <Link
                              to={`/profile/${reel.author.username}`}
                              className="reel-creator-name"
                            >
                              {reel.author.username}
                            </Link>
                            {reel.author.isVerified && (
                              <CheckCircle2
                                size={14}
                                fill="currentColor"
                                color="var(--accent-blue)"
                              />
                            )}
                            {!isOwner && (
                              <button
                                type="button"
                                className={`reel-follow-btn ${
                                  reel.author.isFollowing || reel.author.isPending
                                    ? "following"
                                    : ""
                                }`}
                                disabled={Boolean(followLoadingMap[reel.author.id])}
                                onClick={() => handleFollowAuthor(reel.author)}
                              >
                                {followLabel}
                              </button>
                            )}
                          </div>

                          {/* Caption */}
                          {reel.caption && (
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
                          )}

                          {/* Audio Attribution */}
                          {reel.audioTrack && (
                            <div className="reel-audio-row">
                              <Music size={12} />
                              <span className="reel-audio-title">{reel.audioTrack}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Engagement Rail */}
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
                            {(reel.likesCount || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Comment */}
                        <div className="reel-action-group">
                          <button
                            type="button"
                            className="reel-action-btn"
                            onClick={() => setActiveCommentReel(reel)}
                            title="Comments"
                            aria-label="Comments"
                          >
                            <MessageCircle size={26} />
                          </button>
                          <span className="reel-action-count">
                            {(reel.commentsCount || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* Share */}
                        <div className="reel-action-group">
                          <button
                            type="button"
                            className="reel-action-btn"
                            onClick={() => handleShareReel(reel)}
                            title="Share"
                            aria-label="Share reel"
                          >
                            <Send size={26} />
                          </button>
                          <span className="reel-action-count">
                            {(reel.sharesCount || 0).toLocaleString()}
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

                        {/* Owner Delete Action */}
                        {isOwner && (
                          <button
                            type="button"
                            className="reel-action-btn"
                            onClick={() => handleDeleteReel(reel)}
                            disabled={deletingReelId === reel.id}
                            title="Delete reel"
                            aria-label="Delete reel"
                            style={{ opacity: deletingReelId === reel.id ? 0.5 : 0.9 }}
                          >
                            <Trash2 size={22} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Stage Navigation Controls */}
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
          </>
        )}
      </div>

      {/* Upload Reel Modal */}
      <ReelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onReelCreated={handleReelCreated}
      />

      {/* Reel Comments Modal */}
      <ReelCommentsModal
        reel={activeCommentReel}
        isOpen={Boolean(activeCommentReel)}
        onClose={() => setActiveCommentReel(null)}
        onCommentsCountChange={handleCommentsCountChange}
      />
    </div>
  );
}
