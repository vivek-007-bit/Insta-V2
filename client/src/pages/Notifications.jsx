import React, { useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  UserPlus,
  UserCheck,
  Film,
  ChevronRight,
  Trash2
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import postService from "../services/postService";
import userService from "../services/userService";
import followRequestService from "../services/followRequestService";
import FollowRequestsModal from "../components/modals/FollowRequestsModal";
import { formatRelativeTime } from "../utils/formatTime";

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    notificationsLoading,
    notificationsHasMore,
    notificationsPage,
    notificationsError,
    fetchNotifications,
    markNotificationsAsRead,
    markNotificationAsRead,
    deleteNotification,
    clearAllNotifications,
    posts,
    setSelectedPostDetail,
    followRequests,
    fetchFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    updateFollowState,
    showToast
  } = useApp();

  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [followLoadingMap, setFollowLoadingMap] = useState({});
  const [localFollowOverrides, setLocalFollowOverrides] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications(1, false);
    fetchFollowRequests();
  }, [fetchNotifications, fetchFollowRequests]);

  // Badge icon for each notification type
  const getBadgeIcon = (type) => {
    switch (type) {
      case "like":
        return <Heart size={10} fill="var(--accent-red)" color="var(--accent-red)" />;
      case "reel_like":
        return <Film size={10} color="var(--accent-red)" />;
      case "comment":
      case "reel_comment":
        return <MessageCircle size={10} fill="var(--accent-blue)" color="var(--accent-blue)" />;
      case "follow":
      case "follow_request":
        return <UserPlus size={10} color="var(--accent-blue)" />;
      case "follow_request_accepted":
        return <UserCheck size={10} color="#10b981" />;
      default:
        return <Heart size={10} fill="var(--accent-red)" color="var(--accent-red)" />;
    }
  };

  // Group notifications by real createdAt timestamp
  const groupNotifications = (notifs) => {
    const groups = {
      today: [],
      thisWeek: [],
      earlier: []
    };

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    notifs.forEach((notif) => {
      const createdTime = notif.createdAt ? new Date(notif.createdAt).getTime() : 0;
      const ageMs = now - createdTime;

      if (ageMs <= oneDayMs) {
        groups.today.push(notif);
      } else if (ageMs <= sevenDaysMs) {
        groups.thisWeek.push(notif);
      } else {
        groups.earlier.push(notif);
      }
    });

    return [
      { title: "Today", items: groups.today },
      { title: "This Week", items: groups.thisWeek },
      { title: "Earlier", items: groups.earlier }
    ].filter((section) => section.items.length > 0);
  };

  const sections = groupNotifications(notifications);
  const allRead = unreadCount === 0 && notifications.every((n) => n.isRead);

  // Follow / Follow Back toggle for follow notifications
  const handleFollowToggle = async (e, notif) => {
    e.stopPropagation();
    const sender = notif.sender;
    if (!sender?.id || sender.isDeleted || followLoadingMap[sender.id]) return;

    if (!notif.isRead) {
      markNotificationAsRead(notif.id);
    }

    const currentStatus = localFollowOverrides[sender.id] || {
      isFollowing: Boolean(sender.isFollowing),
      isPending: Boolean(sender.isPending),
      requestId: sender.requestId || null
    };

    setFollowLoadingMap((prev) => ({ ...prev, [sender.id]: true }));
    try {
      let nextState;
      if (currentStatus.isFollowing) {
        await userService.unfollowUser(sender.id);
        nextState = { isFollowing: false, isPending: false, requestId: null };
        showToast(`Unfollowed @${sender.username}`);
      } else if (currentStatus.isPending && currentStatus.requestId) {
        await followRequestService.cancelRequest(currentStatus.requestId);
        nextState = { isFollowing: false, isPending: false, requestId: null };
        showToast("Follow request cancelled");
      } else {
        const res = await userService.followUser(sender.id);
        nextState = {
          isFollowing: Boolean(res.isFollowing),
          isPending: Boolean(res.isPending),
          requestId: res.requestId || null
        };
        showToast(res.message || `Following @${sender.username}`);
      }

      setLocalFollowOverrides((prev) => ({ ...prev, [sender.id]: nextState }));
      updateFollowState(sender.id, nextState);
    } catch (err) {
      showToast(err.message || "Could not update follow status");
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [sender.id]: false }));
    }
  };

  // Handle clicking a notification row or thumbnail
  const handleRowClick = async (notif) => {
    if (!notif.isRead) {
      markNotificationAsRead(notif.id);
    }

    const sender = notif.sender;

    switch (notif.type) {
      case "follow":
      case "follow_request_accepted":
        if (sender && !sender.isDeleted && sender.username) {
          navigate(`/profile/${sender.username}`);
        } else {
          showToast("This user account is no longer available");
        }
        break;

      case "follow_request":
        setIsRequestsModalOpen(true);
        break;

      case "like":
      case "comment": {
        if (!notif.entityId || notif.entityExists === false) {
          showToast("This post has been deleted or is no longer available");
          return;
        }
        const localMatch = posts.find((p) => p.id === notif.entityId);
        if (localMatch) {
          setSelectedPostDetail(localMatch);
          return;
        }
        try {
          const res = await postService.getPostById(notif.entityId);
          if (res?.post) {
            setSelectedPostDetail(res.post);
          }
        } catch (err) {
          showToast(err.message || "This post is no longer accessible");
        }
        break;
      }

      case "reel_like":
      case "reel_comment":
        if (!notif.entityId || notif.entityExists === false) {
          showToast("This reel has been deleted or is no longer available");
          return;
        }
        navigate(`/reels/${notif.entityId}`);
        break;

      default:
        if (sender && !sender.isDeleted && sender.username) {
          navigate(`/profile/${sender.username}`);
        }
    }
  };

  return (
    <div className="notifications-container">
      {/* Header */}
      <header className="notifications-header">
        <h1 className="notifications-title">Notifications</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={markNotificationsAsRead}
            disabled={allRead}
            className="notifications-mark-read-btn"
            aria-label="Mark all notifications as read"
          >
            {allRead ? "All caught up" : "Mark all as read"}
          </button>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAllNotifications}
              className="notifications-mark-read-btn"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Clear all notifications"
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      {/* Incoming Follow Requests Section */}
      {followRequests.length > 0 && (
        <section className="notifications-section" style={{ marginBottom: "18px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px"
            }}
          >
            <h2 className="notifications-section-heading" style={{ margin: 0 }}>
              Follow Requests ({followRequests.length})
            </h2>
            <button
              type="button"
              onClick={() => setIsRequestsModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--accent-blue)",
                fontSize: "var(--font-size-xs)",
                fontWeight: "600"
              }}
            >
              <span>See all</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="notifications-list">
            {followRequests.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="notification-row unread"
                style={{ cursor: "default" }}
              >
                <Link
                  to={`/profile/${req.user.username}`}
                  className="notification-row-left"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div className="notification-avatar-wrap">
                    <img
                      src={req.user.avatar}
                      alt={req.user.username}
                      className="notification-avatar"
                    />
                  </div>
                  <div className="notification-content">
                    <p className="notification-text-line">
                      <span className="notification-username">{req.user.username}</span>{" "}
                      <span className="notification-body-text">requested to follow you.</span>
                    </p>
                  </div>
                </Link>
                <div className="notification-row-right" style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await acceptFollowRequest(req.id);
                      fetchNotifications(1, false);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--accent-blue)",
                      color: "#ffffff",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600"
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await rejectFollowRequest(req.id);
                      fetchNotifications(1, false);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--accent-gray-btn)",
                      color: "var(--text-primary)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600"
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Follow Requests Modal */}
      <FollowRequestsModal
        isOpen={isRequestsModalOpen}
        onClose={() => {
          setIsRequestsModalOpen(false);
          fetchNotifications(1, false);
        }}
      />

      {/* Error State */}
      {notificationsError && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--accent-red)",
            fontSize: "var(--font-size-sm)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{notificationsError}</span>
          <button
            type="button"
            onClick={() => fetchNotifications(1, false)}
            style={{ color: "var(--accent-blue)", fontWeight: "600" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading / Empty / Grouped Activity Feed */}
      {notificationsLoading && notifications.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading notifications...
        </div>
      ) : sections.length === 0 ? (
        <div className="notifications-empty-state">
          <h2 className="notifications-empty-title">Activity on your posts</h2>
          <p className="notifications-empty-sub">
            When someone likes or comments on your posts or reels, or follows you, you’ll see it here.
          </p>
        </div>
      ) : (
        <>
          {sections.map((section) => (
            <section key={section.title} className="notifications-section">
              <h2 className="notifications-section-heading">{section.title}</h2>
              <div className="notifications-list" role="list">
                {section.items.map((notif) => {
                  const sender = notif.sender || notif.user;
                  const statusOverride = sender?.id
                    ? localFollowOverrides[sender.id]
                    : null;
                  const isFollowing = statusOverride
                    ? statusOverride.isFollowing
                    : Boolean(sender?.isFollowing);
                  const isPending = statusOverride
                    ? statusOverride.isPending
                    : Boolean(sender?.isPending);

                  const followButtonText = isFollowing
                    ? "Following"
                    : isPending
                    ? "Requested"
                    : "Follow Back";

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
                            src={sender?.avatar}
                            alt={sender?.username || "User"}
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
                                if (sender && !sender.isDeleted && sender.username) {
                                  if (!notif.isRead) markNotificationAsRead(notif.id);
                                  navigate(`/profile/${sender.username}`);
                                }
                              }}
                            >
                              {sender?.username || "deleted_user"}
                            </span>{" "}
                            <span className="notification-body-text">
                              {notif.text}
                            </span>{" "}
                            <span className="notification-time">
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Thumbnail, Follow Back, Delete, Unread Dot */}
                      <div className="notification-row-right">
                        {notif.targetThumbnail ? (
                          <img
                            src={notif.targetThumbnail}
                            alt="Media thumbnail"
                            className="notification-thumbnail"
                          />
                        ) : (notif.type === "follow" || notif.type === "follow_request_accepted") &&
                          sender &&
                          !sender.isDeleted ? (
                          <button
                            type="button"
                            onClick={(e) => handleFollowToggle(e, notif)}
                            disabled={Boolean(followLoadingMap[sender.id])}
                            className={`notification-follow-btn ${
                              isFollowing || isPending ? "secondary" : "primary"
                            }`}
                          >
                            {followButtonText}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          title="Delete notification"
                          aria-label="Delete notification"
                          style={{
                            color: "var(--text-secondary)",
                            padding: "4px",
                            opacity: 0.6
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

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
          ))}

          {notificationsHasMore && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <button
                type="button"
                onClick={() => fetchNotifications(notificationsPage + 1, true)}
                disabled={notificationsLoading}
                style={{
                  padding: "8px 18px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--accent-gray-btn)",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: "600"
                }}
              >
                {notificationsLoading ? "Loading..." : "Load older notifications"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
