import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import userService from "../../services/userService";
import followRequestService from "../../services/followRequestService";
import { useApp } from "../../context/AppContext";

export default function FollowButton({
  user,
  initialStatus,
  onStatusChange,
  className = "",
  style = {},
  variant = "button" // "button" | "link"
}) {
  const { currentUser, showToast, updateFollowState } = useApp();
  const [loading, setLoading] = useState(false);

  const userId = user?.id || user?._id;
  const isSelf =
    Boolean(user?.isSelf) ||
    (currentUser && (userId === currentUser.id || userId === currentUser._id));

  // Determine current status
  const isFollowing =
    initialStatus?.isFollowing !== undefined
      ? initialStatus.isFollowing
      : Boolean(user?.isFollowing);

  const isPending =
    initialStatus?.isPending !== undefined
      ? initialStatus.isPending
      : Boolean(user?.isPending);

  const requestId = initialStatus?.requestId || user?.requestId;

  if (isSelf) return null;

  const handleClick = async (e) => {
    e?.stopPropagation();
    if (loading || !userId) return;

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await userService.unfollowUser(userId);
        const nextState = { isFollowing: false, isPending: false, requestId: null };
        onStatusChange?.(nextState);
        updateFollowState(userId, nextState);
        showToast(`Unfollowed @${user.username || "user"}`);
      } else if (isPending && requestId) {
        // Cancel pending request
        await followRequestService.cancelRequest(requestId);
        const nextState = { isFollowing: false, isPending: false, requestId: null };
        onStatusChange?.(nextState);
        updateFollowState(userId, nextState);
        showToast("Follow request cancelled");
      } else {
        // Follow (public -> following, private -> requested)
        const res = await userService.followUser(userId);
        const nextState = {
          isFollowing: Boolean(res.isFollowing),
          isPending: Boolean(res.isPending),
          requestId: res.requestId || null
        };
        onStatusChange?.(nextState);
        updateFollowState(userId, nextState);
        showToast(res.message || "Follow updated");
      }
    } catch (err) {
      showToast(err.message || "Could not update follow status");
    } finally {
      setLoading(false);
    }
  };

  let buttonText = "Follow";
  let statusVariant = "primary";

  if (isFollowing) {
    buttonText = "Following";
    statusVariant = "secondary";
  } else if (isPending) {
    buttonText = "Requested";
    statusVariant = "requested";
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`btn-follow-link ${isFollowing ? "following" : ""} ${className}`}
        style={style}
      >
        {loading ? "..." : buttonText}
      </button>
    );
  }

  const variantClass =
    statusVariant === "secondary"
      ? "ig-btn-follow--secondary"
      : statusVariant === "requested"
      ? "ig-btn-follow--requested"
      : "ig-btn-follow--primary";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`ig-btn-follow ${variantClass} ${className}`}
      style={style}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="auth-spin" />
          <span>{buttonText}</span>
        </>
      ) : (
        buttonText
      )}
    </button>
  );
}
