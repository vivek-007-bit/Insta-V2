import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Grid,
  Bookmark,
  Tag,
  Settings,
  CheckCircle2,
  Lock,
  UserPlus
} from "lucide-react";
import { useApp } from "../context/AppContext";
import userService from "../services/userService";
import FollowButton from "../components/shared/FollowButton";
import FollowListModal from "../components/modals/FollowListModal";
import FollowRequestsModal from "../components/modals/FollowRequestsModal";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const {
    currentUser,
    posts: feedPosts,
    savedPostIds,
    setIsEditProfileOpen,
    setSelectedPostDetail,
    followRequests
  } = useApp();

  const [activeTab, setActiveTab] = useState("posts");
  const [profileUser, setProfileUser] = useState(null);
  const [followStatus, setFollowStatus] = useState({
    isFollowing: false,
    isPending: false,
    requestId: null,
    isSelf: true
  });
  const [canViewContent, setCanViewContent] = useState(true);
  const [profilePosts, setProfilePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [followListModal, setFollowListModal] = useState({ isOpen: false, type: "followers" });
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);

  const isOwnProfile =
    !username ||
    (currentUser && username.toLowerCase() === currentUser.username.toLowerCase());

  const targetIdentifier = isOwnProfile ? currentUser?.id : username;

  const loadProfileData = useCallback(async () => {
    if (!targetIdentifier) return;
    setLoading(true);
    setError("");

    try {
      const profileRes = await userService.getUserProfile(targetIdentifier);
      setProfileUser(profileRes.user);
      setFollowStatus(profileRes.followStatus);
      setCanViewContent(Boolean(profileRes.canViewContent));

      if (profileRes.canViewContent) {
        try {
          const postsRes = await userService.getUserPosts(profileRes.user.id, 1, 30);
          setProfilePosts(postsRes.posts || []);
        } catch {
          setProfilePosts([]);
        }
      } else {
        setProfilePosts([]);
      }
    } catch (err) {
      setError(err.message || "User not found");
    } finally {
      setLoading(false);
    }
  }, [targetIdentifier]);

  useEffect(() => {
    loadProfileData();
    setActiveTab("posts");
  }, [loadProfileData]);

  // Keep own profile stats & posts synced with AppContext updates
  useEffect(() => {
    if (isOwnProfile && currentUser && profileUser) {
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

  // Sync new posts added to feedPosts by currentUser
  useEffect(() => {
    if (isOwnProfile && currentUser) {
      const ownFromFeed = feedPosts.filter(
        (p) => p.author?.id === currentUser.id || p.author?.username === currentUser.username
      );
      if (ownFromFeed.length > profilePosts.length) {
        setProfilePosts(ownFromFeed);
      }
    }
  }, [isOwnProfile, currentUser, feedPosts, profilePosts.length]);

  if (loading) {
    return (
      <div style={{ width: "100%", maxWidth: "935px", padding: "60px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading profile...
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div style={{ width: "100%", maxWidth: "935px", padding: "60px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "600" }}>Sorry, this page isn't available.</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "var(--font-size-sm)" }}>
          {error || "The link you followed may be broken, or the profile may have been removed."}
        </p>
      </div>
    );
  }

  const displayPosts = profilePosts;
  const mySavedPosts = feedPosts.filter((p) => savedPostIds.has(p.id));

  const handleOpenFollowList = (type) => {
    if (!canViewContent) return;
    setFollowListModal({ isOpen: true, type });
  };

  const handleFollowStatusChange = (newStatus) => {
    setFollowStatus((prev) => ({ ...prev, ...newStatus }));
    // Reload profile to refresh follower counts & post visibility if followed public account
    loadProfileData();
  };

  return (
    <div style={{ width: "100%", maxWidth: "935px", padding: "30px 20px" }}>
      {/* Profile Header Info */}
      <div
        className="profile-header"
        style={{
          display: "flex",
          gap: "80px",
          alignItems: "center",
          marginBottom: "44px"
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <img
            src={profileUser.avatar}
            alt={profileUser.username}
            className="profile-avatar-large"
            style={{
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--border-subtle)"
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          {/* Username + Actions Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "400" }}>
                {profileUser.username}
              </h2>
              {profileUser.isPrivate && (
                <Lock size={16} style={{ color: "var(--text-secondary)" }} title="Private account" />
              )}
              {profileUser.isVerified && (
                <CheckCircle2 size={18} fill="currentColor" color="var(--accent-blue)" />
              )}
            </div>

            {isOwnProfile ? (
              <>
                <button
                  onClick={() => setIsEditProfileOpen(true)}
                  style={{
                    backgroundColor: "var(--accent-gray-btn)",
                    color: "var(--text-primary)",
                    padding: "7px 16px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: "600"
                  }}
                >
                  Edit profile
                </button>

                {(followRequests.length > 0 || profileUser.isPrivate) && (
                  <button
                    onClick={() => setIsRequestsModalOpen(true)}
                    style={{
                      backgroundColor: followRequests.length > 0 ? "var(--accent-blue)" : "var(--accent-gray-btn)",
                      color: followRequests.length > 0 ? "#ffffff" : "var(--text-primary)",
                      padding: "7px 14px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <UserPlus size={15} />
                    <span>Requests ({followRequests.length})</span>
                  </button>
                )}

                <button
                  onClick={() => navigate("/settings")}
                  style={{ padding: "6px", color: "var(--text-primary)" }}
                  aria-label="Profile settings"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
              </>
            ) : (
              <FollowButton
                user={profileUser}
                initialStatus={followStatus}
                onStatusChange={handleFollowStatusChange}
              />
            )}
          </div>

          {/* Stats Row */}
          <div
            className="profile-stats"
            style={{ display: "flex", gap: "40px", fontSize: "var(--font-size-md)" }}
          >
            <div>
              <span style={{ fontWeight: "600" }}>{profileUser.postsCount ?? displayPosts.length}</span> posts
            </div>
            <button
              type="button"
              onClick={() => handleOpenFollowList("followers")}
              style={{
                cursor: canViewContent ? "pointer" : "default",
                fontSize: "inherit",
                color: "inherit"
              }}
            >
              <span style={{ fontWeight: "600" }}>
                {(profileUser.followersCount || 0).toLocaleString()}
              </span>{" "}
              followers
            </button>
            <button
              type="button"
              onClick={() => handleOpenFollowList("following")}
              style={{
                cursor: canViewContent ? "pointer" : "default",
                fontSize: "inherit",
                color: "inherit"
              }}
            >
              <span style={{ fontWeight: "600" }}>
                {(profileUser.followingCount || 0).toLocaleString()}
              </span>{" "}
              following
            </button>
          </div>

          {/* Bio & Details */}
          <div>
            <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>
              {profileUser.fullName}
            </div>
            <div style={{ whiteSpace: "pre-line", fontSize: "var(--font-size-sm)", marginTop: "4px" }}>
              {profileUser.bio}
            </div>
            {profileUser.website && (
              <a
                href={profileUser.website}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  color: "var(--text-link)",
                  fontWeight: "600",
                  fontSize: "var(--font-size-sm)",
                  marginTop: "4px"
                }}
              >
                {profileUser.website}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Private Account Guard View */}
      {!canViewContent ? (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "64px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              border: "2px solid var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Lock size={28} />
          </div>
          <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: "600" }}>
            This account is private
          </h3>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", maxWidth: "320px" }}>
            Follow @{profileUser.username} to see their photos and videos.
          </p>
        </div>
      ) : (
        <>
          {/* Profile Tabs */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "center",
              gap: "60px"
            }}
          >
            <button
              onClick={() => setActiveTab("posts")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "52px",
                borderTop: activeTab === "posts" ? "1px solid var(--text-primary)" : "none",
                marginTop: activeTab === "posts" ? "-1px" : "0",
                color: activeTab === "posts" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "var(--font-size-xs)",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "1px"
              }}
            >
              <Grid size={12} />
              <span>Posts</span>
            </button>

            {isOwnProfile && (
              <button
                onClick={() => setActiveTab("saved")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "52px",
                  borderTop: activeTab === "saved" ? "1px solid var(--text-primary)" : "none",
                  marginTop: activeTab === "saved" ? "-1px" : "0",
                  color: activeTab === "saved" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "1px"
                }}
              >
                <Bookmark size={12} />
                <span>Saved</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("tagged")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "52px",
                borderTop: activeTab === "tagged" ? "1px solid var(--text-primary)" : "none",
                marginTop: activeTab === "tagged" ? "-1px" : "0",
                color: activeTab === "tagged" ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "var(--font-size-xs)",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "1px"
              }}
            >
              <Tag size={12} />
              <span>Tagged</span>
            </button>
          </div>

          {/* Tab Content Grid */}
          {activeTab === "posts" && (
            <div
              className="media-posts-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "28px",
                marginTop: "16px"
              }}
            >
              {displayPosts.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
                  <p style={{ fontSize: "var(--font-size-lg)", fontWeight: "600" }}>No Posts Yet</p>
                  <p style={{ fontSize: "var(--font-size-sm)", marginTop: "8px" }}>
                    {isOwnProfile
                      ? "When you share photos or videos, they will appear on your profile."
                      : "This user hasn't shared any posts yet."}
                  </p>
                </div>
              ) : (
                displayPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostDetail(post)}
                    style={{
                      aspectRatio: "1 / 1",
                      backgroundColor: "var(--bg-secondary)",
                      overflow: "hidden",
                      cursor: "pointer",
                      borderRadius: "var(--radius-xs)"
                    }}
                  >
                    {post.mediaType === "video" ? (
                      <video
                        src={post.mediaUrl}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <img
                        src={post.mediaUrl}
                        alt={post.caption || "Profile post"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "saved" && isOwnProfile && (
            <div
              className="media-posts-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "28px",
                marginTop: "16px"
              }}
            >
              {mySavedPosts.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
                  <Bookmark size={48} style={{ color: "var(--text-secondary)", margin: "0 auto 12px auto" }} />
                  <p style={{ fontSize: "var(--font-size-lg)", fontWeight: "600" }}>Save Posts</p>
                  <p style={{ fontSize: "var(--font-size-sm)", marginTop: "8px" }}>
                    Save photos and videos that you want to see again.
                  </p>
                </div>
              ) : (
                mySavedPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostDetail(post)}
                    style={{
                      aspectRatio: "1 / 1",
                      backgroundColor: "var(--bg-secondary)",
                      overflow: "hidden",
                      cursor: "pointer",
                      borderRadius: "var(--radius-xs)"
                    }}
                  >
                    <img
                      src={post.mediaUrl}
                      alt={post.caption || "Saved post"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "tagged" && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
              <Tag size={48} style={{ color: "var(--text-secondary)", margin: "0 auto 12px auto" }} />
              <p style={{ fontSize: "var(--font-size-lg)", fontWeight: "600" }}>Photos of you</p>
              <p style={{ fontSize: "var(--font-size-sm)", marginTop: "8px" }}>
                When people tag you in photos, they'll appear here.
              </p>
            </div>
          )}
        </>
      )}

      {/* Followers / Following Modal */}
      <FollowListModal
        isOpen={followListModal.isOpen}
        onClose={() => {
          setFollowListModal({ isOpen: false, type: "followers" });
          loadProfileData();
        }}
        userId={profileUser.id}
        type={followListModal.type}
      />

      {/* Follow Requests Modal */}
      <FollowRequestsModal
        isOpen={isRequestsModalOpen}
        onClose={() => {
          setIsRequestsModalOpen(false);
          loadProfileData();
        }}
      />
    </div>
  );
}
