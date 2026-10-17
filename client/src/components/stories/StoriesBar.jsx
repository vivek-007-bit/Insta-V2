import React from "react";
import { Plus } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function StoriesBar() {
  const {
    currentUser,
    stories,
    setActiveStoryIndex,
    setIsCreateStoryOpen
  } = useApp();

  // Find if current user already has existing stories
  const currentUserStoryIndex = stories.findIndex(
    s => s.userId === currentUser.id || s.username === currentUser.username
  );
  const currentUserStory = currentUserStoryIndex !== -1 ? stories[currentUserStoryIndex] : null;

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

  return (
    <section className="stories-bar" aria-label="Stories">
      {/* Current User Story Item */}
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
              src={currentUser.avatar}
              alt="Your story"
              className="story-avatar-img"
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

      {/* Other Users' Stories list */}
      {stories
        .filter(s => s.userId !== currentUser.id && s.username !== currentUser.username)
        .map((story) => {
          const originalIndex = stories.findIndex(s => s.id === story.id);
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
                    src={story.userAvatar}
                    alt={story.username}
                    className="story-avatar-img"
                  />
                </div>
              </div>
              <span className="story-username">{story.username}</span>
            </button>
          );
        })}
    </section>
  );
}
