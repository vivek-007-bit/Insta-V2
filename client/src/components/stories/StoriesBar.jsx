import React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";

export default function StoriesBar() {
  const {
    currentUser,
    stories,
    storiesLoading,
    storiesError,
    fetchStoriesFeed,
    setActiveStoryIndex,
    setIsCreateStoryOpen
  } = useApp();

  if (!currentUser) return null;

  // Find if current user already has existing active stories
  const currentUserStoryIndex = stories.findIndex(
    (s) => s.isOwn || s.userId === currentUser.id || s.username === currentUser.username
  );
  const currentUserStory = currentUserStoryIndex !== -1 ? stories[currentUserStoryIndex] : null;
  const otherStories = stories.filter(
    (s) => !s.isOwn && s.userId !== currentUser.id && s.username !== currentUser.username
  );

  const handleAvatarClick = () => {
    if (currentUserStory && currentUserStory.stories.length > 0) {
      setActiveStoryIndex(currentUserStoryIndex);
    } else {
      setIsCreateStoryOpen(true);
    }
  };

  const handlePlusClick = (e) => {
    e.stopPropagation(); // Prevent triggering story viewer on the parent avatar
    setIsCreateStoryOpen(true);
  };

  const ownAvatarUrl =
    optimizeMediaUrl(currentUser.avatar, { width: 150, isAvatar: true }) ||
    getAvatarFallbackUrl(currentUser.username);

  return (
    <section className="stories-bar" aria-label="Stories">
      {/* Current User Story Item (Always first) */}
      <div
        className="story-item"
        onClick={handleAvatarClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleAvatarClick();
          }
        }}
        title={currentUserStory ? "View your story" : "Add to your story"}
      >
        <div
          className={`story-avatar-container ${
            currentUserStory?.hasUnseen ? "story-ring-unseen" : "story-ring-seen"
          }`}
        >
          <div className="story-avatar-inner">
            <img
              src={ownAvatarUrl}
              alt="Your story"
              className="story-avatar-img"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getAvatarFallbackUrl(currentUser.username);
              }}
            />
          </div>
          <button
            type="button"
            className="story-add-badge"
            onClick={handlePlusClick}
            aria-label="Add to story"
            title="Add to story"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>
        <span className="story-username">Your story</span>
      </div>

      {/* Loading Skeletons */}
      {storiesLoading && stories.length === 0 ? (
        Array.from({ length: 6 }).map((_, idx) => (
          <div key={`skeleton_${idx}`} className="story-item story-item-skeleton" aria-hidden="true">
            <div className="story-avatar-skeleton" />
            <div className="story-username-skeleton" />
          </div>
        ))
      ) : storiesError && stories.length === 0 ? (
        <div className="stories-error-inline">
          <span>Unable to load stories.</span>
          <button
            type="button"
            className="stories-retry-btn"
            onClick={() => fetchStoriesFeed()}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      ) : otherStories.length === 0 ? (
        <div className="stories-empty-hint">
          Follow accounts to see their stories here.
        </div>
      ) : (
        otherStories.map((story) => {
          const originalIndex = stories.findIndex((s) => s.id === story.id);
          const avatarSrc =
            optimizeMediaUrl(story.userAvatar, { width: 150, isAvatar: true }) ||
            getAvatarFallbackUrl(story.username);

          return (
            <button
              key={story.id}
              type="button"
              className="story-item"
              onClick={() => setActiveStoryIndex(originalIndex)}
              title={`View ${story.username}'s story`}
            >
              <div
                className={`story-avatar-container ${
                  story.hasUnseen ? "story-ring-unseen" : "story-ring-seen"
                }`}
              >
                <div className="story-avatar-inner">
                  <img
                    src={avatarSrc}
                    alt={story.username}
                    className="story-avatar-img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getAvatarFallbackUrl(story.username);
                    }}
                  />
                </div>
              </div>
              <span className="story-username">{story.username}</span>
            </button>
          );
        })
      )}
    </section>
  );
}
