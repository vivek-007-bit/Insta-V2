import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function StoryViewerModal() {
  const { stories, setStories, activeStoryIndex, setActiveStoryIndex } = useApp();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const activeUserStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  // Mark active user story as seen when opened
  useEffect(() => {
    if (activeStoryIndex !== null) {
      setStories(prev =>
        prev.map((s, idx) => (idx === activeStoryIndex ? { ...s, hasUnseen: false } : s))
      );
      setCurrentSlideIndex(0);
      setProgress(0);
    }
  }, [activeStoryIndex, setStories]);

  // Handle Close
  const handleClose = () => {
    setActiveStoryIndex(null);
    setCurrentSlideIndex(0);
    setProgress(0);
  };

  // Next Slide / Story
  const handleNext = () => {
    if (!activeUserStory) return;
    if (currentSlideIndex < activeUserStory.stories.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      setProgress(0);
    } else if (activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(prev => prev + 1);
      setCurrentSlideIndex(0);
      setProgress(0);
    } else {
      handleClose();
    }
  };

  // Prev Slide / Story
  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      setProgress(0);
    } else if (activeStoryIndex > 0) {
      setActiveStoryIndex(prev => prev - 1);
      setCurrentSlideIndex(0);
      setProgress(0);
    }
  };

  // Timer progression effect with proper cleanup and pause/resume
  useEffect(() => {
    if (activeStoryIndex === null || isPaused) return;

    const interval = setInterval(() => {
      setProgress(oldProgress => {
        if (oldProgress >= 100) {
          handleNext();
          return 0;
        }
        return oldProgress + 2; // ~5 seconds duration
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryIndex, currentSlideIndex, isPaused, activeUserStory]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStoryIndex, currentSlideIndex]);

  if (activeStoryIndex === null || !activeUserStory) return null;

  const currentSlide = activeUserStory.stories[currentSlideIndex] || activeUserStory.stories[0];

  return (
    <div className="story-viewer-modal" role="dialog" aria-modal="true">
      <button
        className="story-viewer-close-btn"
        onClick={handleClose}
        aria-label="Close stories"
      >
        <X size={28} />
      </button>

      {/* Prev Navigation Button */}
      {(activeStoryIndex > 0 || currentSlideIndex > 0) && (
        <button
          className="story-nav-btn story-nav-prev"
          onClick={handlePrev}
          aria-label="Previous story"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Main Story Container */}
      <div
        className="story-viewer-content"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Progress Bars */}
        <div className="story-progress-bar-container">
          {activeUserStory.stories.map((slide, sIdx) => {
            let fillWidth = "0%";
            if (sIdx < currentSlideIndex) fillWidth = "100%";
            else if (sIdx === currentSlideIndex) fillWidth = `${progress}%`;

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
        <div className="story-viewer-header">
          <div className="story-viewer-user-info">
            <img
              src={activeUserStory.userAvatar}
              alt={activeUserStory.username}
              className="story-viewer-avatar"
            />
            <span className="story-viewer-username">
              {activeUserStory.username}
            </span>
            <span className="story-viewer-time">{currentSlide.timestamp}</span>
          </div>
        </div>

        {/* Story Media */}
        <div className="story-viewer-media-container" onClick={handleNext}>
          {currentSlide.mediaType === "video" || currentSlide.mediaUrl?.includes("video") || currentSlide.mediaUrl?.endsWith(".mp4") ? (
            <video
              src={currentSlide.mediaUrl}
              autoPlay
              playsInline
              loop
              className="story-viewer-img"
              style={{ objectFit: "contain", backgroundColor: "#000" }}
            />
          ) : (
            <img
              src={currentSlide.mediaUrl}
              alt="Story content"
              className="story-viewer-img"
            />
          )}
          {currentSlide.caption && (
            <div className="story-viewer-caption">
              {currentSlide.caption}
            </div>
          )}
        </div>
      </div>

      {/* Next Navigation Button */}
      {(activeStoryIndex < stories.length - 1 ||
        currentSlideIndex < activeUserStory.stories.length - 1) && (
        <button
          className="story-nav-btn story-nav-next"
          onClick={handleNext}
          aria-label="Next story"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}
