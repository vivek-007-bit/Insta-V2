import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Grid,
  Film,
  Bookmark,
  Settings,
  CheckCircle2,
  Lock,
  UserPlus,
  Heart,
  MessageCircle,
  Link2,
  Camera,
  Loader2
} from "lucide-react";
import { useApp } from "../context/AppContext";
import userService from "../services/userService";
import FollowButton from "../components/shared/FollowButton";
import FollowListModal from "../components/modals/FollowListModal";
import FollowRequestsModal from "../components/modals/FollowRequestsModal";
import MediaRenderer from "../components/shared/MediaRenderer";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../utils/cloudinaryUrl";

const formatWebsiteHref = (rawUrl) => {
  const clean = String(rawUrl || "").trim();
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
};

const formatWebsiteLabel = (rawUrl) => {
  return String(rawUrl || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/+$/, "");
};

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const {
    currentUser,
    posts: feedPosts,
    savedPostIds,
    setIsEditProfileOpen,
    setSelectedPostDetail,
    followRequests,
    createOrOpenConversation
  } = useApp();

  const [activeTab, setActiveTab] = useState("posts"); // "posts" | "reels" | "saved"
  const [profileUser, setProfileUser] = useState(null);
  const [followStatus, setFollowStatus] = useState({
    isFollowing: false,
    isPending: false,
    requestId: null,
    isSelf: true
  });
  const [canViewContent, setCanViewContent] = useState(true);
  const [profilePosts, setProfilePosts] = useState([]);
  const [profileReels, setProfileReels] = useState([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messagingLoading, setMessagingLoading] = useState(false);

  // Modals
  const [followListModal, setFollowListModal] = useState({ isOpen: false, type: "followers" });
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);

  const isOwnProfile =
    !username ||
    (currentUser && username.toLowerCase() === currentUser.username.toLowerCase());

  const targetIdentifier = isOwnProfile ? currentUser?.id : username;
  const lastLoadedIdentifierRef = useRef(null);

  const loadProfileData = useCallback(
    async ({ silent = false } = {}) => {
      if (!targetIdentifier) return;
      if (!silent) {
        setLoading(true);
      }
      setError("");

      try {
        const profileRes = await userService.getUserProfile(targetIdentifier);
        setProfileUser(profileRes.user);
        setFollowStatus(profileRes.followStatus);
        const allowed = Boolean(profileRes.canViewContent);
        setCanViewContent(allowed);

        if (allowed) {
          setReelsLoading(!silent);
          const [postsResult, reelsResult] = await Promise.allSettled([
            userService.getUserPosts(profileRes.user.id, 1, 30),
            userService.getUserReels(profileRes.user.id, 1, 30)
          ]);

          if (postsResult.status === "fulfilled") {
            setProfilePosts(postsResult.value?.posts || []);
          } else if (!silent) {
            setProfilePosts([]);
          }

          if (reelsResult.status === "fulfilled") {
            setProfileReels(reelsResult.value?.reels || []);
          } else if (!silent) {
            setProfileReels([]);
          }
          setReelsLoading(false);
        } else {
          setProfilePosts([]);
          setProfileReels([]);
          setReelsLoading(false);
        }
      } catch (err) {
        if (!silent) {
          setError(err.message || "User not found");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [targetIdentifier]
  );

  useEffect(() => {
    if (!targetIdentifier) return;
    const isDifferentProfile = lastLoadedIdentifierRef.current !== targetIdentifier;
    lastLoadedIdentifierRef.current = targetIdentifier;

    loadProfileData({ silent: !isDifferentProfile && Boolean(profileUser) });
    if (isDifferentProfile) {
      setActiveTab("posts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIdentifier, loadProfileData]);

  // Keep own profile stats & details synced with AppContext updates without refetching or scrolling
  useEffect(() => {
    if (isOwnProfile && currentUser) {
      setProfileUser((prev) =>
        prev
          ? {
              ...prev,
              fullName: currentUser.fullName,
              username: currentUser.username,
              bio: currentUser.bio,
              website: currentUser.website,
              avatar: currentUser.avatar,
              isPrivate: currentUser.isPrivate,
              followersCount: currentUser.followersCount,
              followingCount: currentUser.followingCount
            }
          : prev
      );
    }
  }, [isOwnProfile, currentUser]);

  // Sync new posts & engagement updates from AppContext feedPosts without refetching
  useEffect(() => {
    if (!feedPosts || feedPosts.length === 0) return;

    const feedById = new Map(feedPosts.map((p) => [p.id, p]));

    setProfilePosts((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const match = feedById.get(p.id);
        if (
          match &&
          (match.isLiked !== p.isLiked ||
            match.likesCount !== p.likesCount ||
            match.commentsCount !== p.commentsCount ||
            match.isSaved !== p.isSaved)
        ) {
          changed = true;
          return {
            ...p,
            isLiked: match.isLiked,
            likesCount: match.likesCount,
            commentsCount: match.commentsCount,
            isSaved: match.isSaved
          };
        }
        return p;
      });

      if (isOwnProfile && currentUser) {
        const existingIds = new Set(updated.map((p) => p.id));
        const newOwnPosts = feedPosts.filter(
          (p) =>
            !existingIds.has(p.id) &&
            (p.author?.id === currentUser.id || p.author?.username === currentUser.username)
        );
        if (newOwnPosts.length > 0) {
          return [...newOwnPosts, ...updated];
        }
      }

      return changed ? updated : prev;
    });
  }, [isOwnProfile, currentUser, feedPosts]);

  const handleOpenFollowList = useCallback(
    (type) => {
      if (!canViewContent) return;
      setFollowListModal({ isOpen: true, type });
    },
    [canViewContent]
  );

  const handleCloseFollowList = useCallback(
    (didMutate = false) => {
      setFollowListModal((prev) => ({ ...prev, isOpen: false }));
      if (didMutate) {
        loadProfileData({ silent: true });
      }
    },
    [loadProfileData]
  );

  const handleCloseRequestsModal = useCallback(() => {
    setIsRequestsModalOpen(false);
  }, []);

  const handleFollowStatusChange = useCallback(
    (newStatus) => {
      setFollowStatus((prev) => ({ ...prev, ...newStatus }));
      loadProfileData({ silent: true });
    },
    [loadProfileData]
  );

  const handleMessageUser = useCallback(async () => {
    if (!profileUser || messagingLoading) return;
    setMessagingLoading(true);
    try {
      const convId = await createOrOpenConversation(profileUser);
      if (convId) {
        navigate("/messages");
      }
    } finally {
      setMessagingLoading(false);
    }
  }, [createOrOpenConversation, messagingLoading, navigate, profileUser]);

  const mySavedPosts = useMemo(() => {
    const merged = new Map();
    [...feedPosts, ...profilePosts].forEach((p) => {
      if (p?.id && savedPostIds.has(p.id) && !merged.has(p.id)) {
        merged.set(p.id, p);
      }
    });
    return Array.from(merged.values());
  }, [feedPosts, profilePosts, savedPostIds]);

  if (loading) {
    return (
      <div className="ig-profile-page" aria-busy="true" aria-label="Loading profile">
        <div className="ig-profile-skeleton-header">
          <div className="ig-profile-skeleton-avatar" />
          <div className="ig-profile-skeleton-lines">
            <div className="ig-profile-skeleton-bar lg" />
            <div className="ig-profile-skeleton-bar md" />
            <div className="ig-profile-skeleton-bar sm" />
          </div>
        </div>
        <div className="ig-profile-grid">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="ig-profile-tile-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="ig-profile-page ig-profile-not-found">
        <h2>Sorry, this page isn't available.</h2>
        <p>
          {error || "The link you followed may be broken, or the profile may have been removed."}
        </p>
        <button
          type="button"
          className="ig-profile-btn primary"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </div>
    );
  }

  const displayPosts = profilePosts;
  const postsCount = profileUser.postsCount ?? displayPosts.length;
  const followersCount = profileUser.followersCount || 0;
  const followingCount = profileUser.followingCount || 0;
  const avatarSrc =
    optimizeMediaUrl(profileUser.avatar, { width: 320, isAvatar: true }) ||
    getAvatarFallbackUrl(profileUser.username);
  const websiteHref = formatWebsiteHref(profileUser.website);
  const websiteLabel = formatWebsiteLabel(profileUser.website);

  const actionControls = isOwnProfile ? (
    <div className="ig-profile-actions">
      <button
        type="button"
        className="ig-profile-btn"
        onClick={() => setIsEditProfileOpen(true)}
      >
        Edit profile
      </button>

      {(followRequests.length > 0 || profileUser.isPrivate) && (
        <button
          type="button"
          className={`ig-profile-btn ${followRequests.length > 0 ? "primary" : ""}`}
          onClick={() => setIsRequestsModalOpen(true)}
        >
          <UserPlus size={15} />
          <span>Requests ({followRequests.length})</span>
        </button>
      )}

      <button
        type="button"
        className="ig-profile-icon-btn"
        onClick={() => navigate("/settings")}
        aria-label="Settings"
        title="Settings"
      >
        <Settings size={20} />
      </button>
    </div>
  ) : (
    <div className="ig-profile-actions">
      <FollowButton
        user={profileUser}
        initialStatus={followStatus}
        onStatusChange={handleFollowStatusChange}
        className="ig-profile-follow-btn"
      />
      <button
        type="button"
        className="ig-profile-btn"
        onClick={handleMessageUser}
        disabled={messagingLoading}
      >
        {messagingLoading ? (
          <>
            <Loader2 size={14} className="auth-spin" />
            <span>Opening...</span>
          </>
        ) : (
          <span>Message</span>
        )}
      </button>
    </div>
  );

  return (
    <div className="ig-profile-page">
      {/* Desktop & Mobile Responsive Header */}
      <header className="ig-profile-header">
        <div className="ig-profile-avatar-col">
          <div className="ig-profile-avatar-ring">
            <img
              src={avatarSrc}
              alt={profileUser.username}
              className="ig-profile-avatar"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getAvatarFallbackUrl(profileUser.username);
              }}
            />
          </div>
        </div>

        <div className="ig-profile-info-col">
          {/* Top Row: Username + Badges + Action Buttons */}
          <div className="ig-profile-top-row">
            <div className="ig-profile-username-wrap">
              <h1 className="ig-profile-username">{profileUser.username}</h1>
              {profileUser.isPrivate && (
                <Lock size={15} className="ig-profile-lock-icon" aria-label="Private account" />
              )}
              {profileUser.isVerified && (
                <CheckCircle2
                  size={17}
                  fill="currentColor"
                  className="ig-profile-verified-icon"
                  aria-label="Verified account"
                />
              )}
            </div>

            {actionControls}
          </div>

          {/* Desktop Stats Row */}
          <div className="ig-profile-stats-desktop">
            <div className="ig-profile-stat-item">
              <strong>{postsCount.toLocaleString()}</strong> posts
            </div>
            <button
              type="button"
              className={`ig-profile-stat-btn ${canViewContent ? "is-interactive" : ""}`}
              onClick={() => handleOpenFollowList("followers")}
              disabled={!canViewContent}
            >
              <strong>{followersCount.toLocaleString()}</strong> followers
            </button>
            <button
              type="button"
              className={`ig-profile-stat-btn ${canViewContent ? "is-interactive" : ""}`}
              onClick={() => handleOpenFollowList("following")}
              disabled={!canViewContent}
            >
              <strong>{followingCount.toLocaleString()}</strong> following
            </button>
          </div>

          {/* Bio & Website (Desktop) */}
          <div className="ig-profile-bio-block ig-profile-bio-desktop">
            {profileUser.fullName && (
              <div className="ig-profile-fullname">{profileUser.fullName}</div>
            )}
            {profileUser.bio && <div className="ig-profile-bio">{profileUser.bio}</div>}
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="ig-profile-website"
              >
                <Link2 size={13} />
                <span>{websiteLabel}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bio & Stats Block */}
      <div className="ig-profile-bio-block ig-profile-bio-mobile">
        {profileUser.fullName && (
          <div className="ig-profile-fullname">{profileUser.fullName}</div>
        )}
        {profileUser.bio && <div className="ig-profile-bio">{profileUser.bio}</div>}
        {websiteHref && (
          <a
            href={websiteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ig-profile-website"
          >
            <Link2 size={13} />
            <span>{websiteLabel}</span>
          </a>
        )}
      </div>

      <div className="ig-profile-stats-mobile">
        <div className="ig-profile-mobile-stat">
          <strong>{postsCount.toLocaleString()}</strong>
          <span>posts</span>
        </div>
        <button
          type="button"
          className="ig-profile-mobile-stat"
          onClick={() => handleOpenFollowList("followers")}
          disabled={!canViewContent}
        >
          <strong>{followersCount.toLocaleString()}</strong>
          <span>followers</span>
        </button>
        <button
          type="button"
          className="ig-profile-mobile-stat"
          onClick={() => handleOpenFollowList("following")}
          disabled={!canViewContent}
        >
          <strong>{followingCount.toLocaleString()}</strong>
          <span>following</span>
        </button>
      </div>

      {/* Private Account Guard View vs Content Tabs */}
      {!canViewContent ? (
        <div className="ig-profile-private-wall">
          <div className="ig-profile-private-circle">
            <Lock size={28} strokeWidth={1.6} />
          </div>
          <h3>This account is private</h3>
          <p>Follow @{profileUser.username} to see their photos and videos.</p>
        </div>
      ) : (
        <>
          <nav className="ig-profile-tabs" role="tablist" aria-label="Profile content sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "posts"}
              className={`ig-profile-tab ${activeTab === "posts" ? "active" : ""}`}
              onClick={() => setActiveTab("posts")}
            >
              <Grid size={13} />
              <span>Posts</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "reels"}
              className={`ig-profile-tab ${activeTab === "reels" ? "active" : ""}`}
              onClick={() => setActiveTab("reels")}
            >
              <Film size={13} />
              <span>Reels</span>
            </button>

            {isOwnProfile && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "saved"}
                className={`ig-profile-tab ${activeTab === "saved" ? "active" : ""}`}
                onClick={() => setActiveTab("saved")}
              >
                <Bookmark size={13} />
                <span>Saved</span>
              </button>
            )}
          </nav>

          {/* POSTS TAB */}
          {activeTab === "posts" && (
            displayPosts.length === 0 ? (
              <div className="ig-profile-empty-state">
                <div className="ig-profile-empty-circle">
                  <Camera size={28} strokeWidth={1.5} />
                </div>
                <h3>No Posts Yet</h3>
                <p>
                  {isOwnProfile
                    ? "When you share photos or videos, they will appear on your profile."
                    : "This user hasn't shared any posts yet."}
                </p>
              </div>
            ) : (
              <div className="ig-profile-grid">
                {displayPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className="ig-profile-tile"
                    onClick={() => setSelectedPostDetail(post)}
                    aria-label={post.caption || "Open post"}
                  >
                    <MediaRenderer
                      src={post.mediaUrl}
                      mediaType={post.mediaType}
                      alt={post.caption || "Profile post"}
                      variant="grid"
                    />
                    {post.mediaType === "video" && (
                      <span className="ig-profile-tile-badge" aria-hidden="true">
                        <Film size={15} />
                      </span>
                    )}
                    <div className="ig-profile-tile-overlay">
                      <span>
                        <Heart size={18} fill="currentColor" />
                        {(post.likesCount || 0).toLocaleString()}
                      </span>
                      <span>
                        <MessageCircle size={18} fill="currentColor" />
                        {(post.commentsCount || 0).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* REELS TAB */}
          {activeTab === "reels" && (
            reelsLoading ? (
              <div className="ig-profile-grid ig-profile-grid--reels" aria-busy="true">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="ig-profile-tile-skeleton reel" />
                ))}
              </div>
            ) : profileReels.length === 0 ? (
              <div className="ig-profile-empty-state">
                <div className="ig-profile-empty-circle">
                  <Film size={28} strokeWidth={1.5} />
                </div>
                <h3>No Reels Yet</h3>
                <p>
                  {isOwnProfile
                    ? "Reels you upload will appear here."
                    : `@${profileUser.username} hasn't shared any Reels yet.`}
                </p>
              </div>
            ) : (
              <div className="ig-profile-grid ig-profile-grid--reels">
                {profileReels.map((reel) => (
                  <button
                    key={reel.id}
                    type="button"
                    className="ig-profile-tile reel"
                    onClick={() => navigate(`/reels/${encodeURIComponent(reel.id)}`)}
                    aria-label={reel.caption || "Watch reel"}
                  >
                    <MediaRenderer
                      src={reel.thumbnailUrl || reel.videoUrl}
                      mediaType={reel.thumbnailUrl ? "image" : "video"}
                      alt={reel.caption || "Profile reel"}
                      variant="grid"
                    />
                    <span className="ig-profile-tile-badge" aria-hidden="true">
                      <Film size={15} />
                    </span>
                    <div className="ig-profile-tile-overlay">
                      <span>
                        <Heart size={18} fill="currentColor" />
                        {(reel.likesCount || 0).toLocaleString()}
                      </span>
                      <span>
                        <MessageCircle size={18} fill="currentColor" />
                        {(reel.commentsCount || 0).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* SAVED TAB (Own profile only) */}
          {activeTab === "saved" && isOwnProfile && (
            mySavedPosts.length === 0 ? (
              <div className="ig-profile-empty-state">
                <div className="ig-profile-empty-circle">
                  <Bookmark size={28} strokeWidth={1.5} />
                </div>
                <h3>Save Posts</h3>
                <p>Save photos and videos that you want to see again. Only you can see what you've saved.</p>
              </div>
            ) : (
              <div className="ig-profile-grid">
                {mySavedPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className="ig-profile-tile"
                    onClick={() => setSelectedPostDetail(post)}
                    aria-label={post.caption || "Open saved post"}
                  >
                    <MediaRenderer
                      src={post.mediaUrl}
                      mediaType={post.mediaType}
                      alt={post.caption || "Saved post"}
                      variant="grid"
                    />
                    <div className="ig-profile-tile-overlay">
                      <span>
                        <Heart size={18} fill="currentColor" />
                        {(post.likesCount || 0).toLocaleString()}
                      </span>
                      <span>
                        <MessageCircle size={18} fill="currentColor" />
                        {(post.commentsCount || 0).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Followers / Following Modal */}
      <FollowListModal
        isOpen={followListModal.isOpen}
        onClose={handleCloseFollowList}
        userId={profileUser.id}
        type={followListModal.type}
      />

      {/* Follow Requests Modal */}
      <FollowRequestsModal
        isOpen={isRequestsModalOpen}
        onClose={handleCloseRequestsModal}
      />
    </div>
  );
}
