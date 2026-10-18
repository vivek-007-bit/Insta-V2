import React from "react";
import { Heart, MessageCircle, UserPlus, AtSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Notifications() {
  const {
    notifications,
    markNotificationsAsRead,
    markNotificationAsRead,
    posts,
    setSelectedPostDetail,
    suggestedUsers,
    toggleFollowUser,
    showToast
  } = useApp();

  const navigate = useNavigate();

  // Type badge icon helper
  const getBadgeIcon = (type) => {
    switch (type) {
      case "like":
        return <Heart size={10} fill="var(--accent-red)" color="var(--accent-red)" />;
      case "comment":
        return <MessageCircle size={10} fill="var(--accent-blue)" color="var(--accent-blue)" />;
      case "follow":
        return <UserPlus size={10} color="var(--accent-blue)" />;
      case "mention":
        return <AtSign size={10} color="#10b981" />;
      default:
        return <Heart size={10} fill="var(--accent-red)" color="var(--accent-red)" />;
    }
  };

  // Group notifications by timestamp
  const groupNotifications = (notifs) => {
    const groups = {
      today: [],
      thisWeek: [],
      earlier: []
    };

    notifs.forEach(notif => {
      const time = notif.timestamp || "";
      if (time.includes("m") || time.includes("h")) {
        groups.today.push(notif);
      } else if (time.includes("d") || time.includes("1w")) {
        groups.thisWeek.push(notif);
      } else {
        groups.earlier.push(notif);
      }
    });

    return [
      { title: "Today", items: groups.today },
      { title: "This Week", items: groups.thisWeek },
      { title: "Earlier", items: groups.earlier }
    ].filter(section => section.items.length > 0);
  };

  const sections = groupNotifications(notifications);
  const allRead = notifications.every(n => n.isRead);

  // Check if target user is currently followed
  const isUserFollowing = (username) => {
    const found = suggestedUsers.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );
    return found ? found.isFollowing : false;
  };

  // Handle follow / following toggle
  const handleFollowToggle = (e, notif) => {
    e.stopPropagation();
    const found = suggestedUsers.find(
      u => u.username.toLowerCase() === notif.user.username.toLowerCase()
    );
    if (found) {
      toggleFollowUser(found.id);
      showToast(found.isFollowing ? `Unfollowed @${notif.user.username}` : `Following @${notif.user.username}`);
    } else {
      showToast(`Followed @${notif.user.username} back!`);
    }
    if (!notif.isRead && markNotificationAsRead) {
      markNotificationAsRead(notif.id);
    }
  };

  // Handle row click
  const handleRowClick = (notif) => {
    if (!notif.isRead && markNotificationAsRead) {
      markNotificationAsRead(notif.id);
    }

    if (notif.postId) {
      const matchedPost = posts.find(p => p.id === notif.postId);
      if (matchedPost) {
        setSelectedPostDetail(matchedPost);
        return;
      }
    }

    if (notif.type === "follow") {
      navigate("/profile");
      return;
    }

    if (notif.targetThumbnail && posts.length > 0) {
      setSelectedPostDetail(posts[0]);
      return;
    }

    navigate("/profile");
  };

  // Handle thumbnail click specifically
  const handleThumbnailClick = (e, notif) => {
    e.stopPropagation();
    if (!notif.isRead && markNotificationAsRead) {
      markNotificationAsRead(notif.id);
    }
    if (notif.postId) {
      const matchedPost = posts.find(p => p.id === notif.postId);
      if (matchedPost) {
        setSelectedPostDetail(matchedPost);
        return;
      }
    }
    if (posts.length > 0) {
      setSelectedPostDetail(posts[0]);
    }
  };

  return (
    <div className="notifications-container">
      {/* Header */}
      <header className="notifications-header">
        <h1 className="notifications-title">Notifications</h1>
        <button
          type="button"
          onClick={markNotificationsAsRead}
          disabled={allRead}
          className="notifications-mark-read-btn"
          aria-label="Mark all notifications as read"
        >
          {allRead ? "All caught up" : "Mark all as read"}
        </button>
      </header>

      {/* Grouped Activity Feed */}
      {sections.length === 0 ? (
        <div className="notifications-empty-state">
          <h2 className="notifications-empty-title">Activity on your posts</h2>
          <p className="notifications-empty-sub">
            When someone likes or comments on one of your posts, or follows you, you’ll see it here.
          </p>
        </div>
      ) : (
        sections.map(section => (
          <section key={section.title} className="notifications-section">
            <h2 className="notifications-section-heading">{section.title}</h2>
            <div className="notifications-list" role="list">
              {section.items.map(notif => {
                const following = isUserFollowing(notif.user.username);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleRowClick(notif)}
                    className={`notification-row ${notif.isRead ? "read" : "unread"}`}
                    role="listitem"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(notif);
                      }
                    }}
                  >
                    {/* Left: Avatar with badge + Description */}
                    <div className="notification-row-left">
                      <div className="notification-avatar-wrap">
                        <img
                          src={notif.user.avatar}
                          alt={notif.user.username}
                          className="notification-avatar"
                        />
                        <div
                          className="notification-badge-icon"
                          title={notif.type}
                        >
                          {getBadgeIcon(notif.type)}
                        </div>
                      </div>

                      <div className="notification-content">
                        <p className="notification-text-line">
                          <span
                            className="notification-username"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/profile");
                            }}
                          >
                            {notif.user.username}
                          </span>
                          <span className="notification-body-text">
                            {notif.text}
                          </span>
                          {" "}
                          <span className="notification-time">
                            {notif.timestamp}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions, Post Thumbnail, or Follow Back */}
                    <div className="notification-row-right">
                      {notif.targetThumbnail ? (
                        <img
                          src={notif.targetThumbnail}
                          alt="Post thumbnail"
                          className="notification-thumbnail"
                          onClick={(e) => handleThumbnailClick(e, notif)}
                        />
                      ) : notif.type === "follow" ? (
                        <button
                          type="button"
                          onClick={(e) => handleFollowToggle(e, notif)}
                          className={`notification-follow-btn ${following ? "secondary" : "primary"}`}
                        >
                          {following ? "Following" : "Follow Back"}
                        </button>
                      ) : null}

                      {!notif.isRead && (
                        <span
                          className="notification-unread-dot"
                          title="Unread notification"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
