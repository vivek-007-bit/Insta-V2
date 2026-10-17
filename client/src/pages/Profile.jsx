import React, { useState } from "react";
import { Grid, Bookmark, Tag, Settings, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Profile() {
  const { currentUser, posts, savedPostIds, setIsEditProfileOpen, setSelectedPostDetail } = useApp();
  const [activeTab, setActiveTab] = useState("posts"); // 'posts', 'saved', 'tagged'

  // Current user's posts
  const myPosts = posts.filter(p => p.author.username === currentUser.username);
  const mySavedPosts = posts.filter(p => savedPostIds.has(p.id));

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
            src={currentUser.avatar}
            alt={currentUser.username}
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
          {/* Username + Edit Profile Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "400" }}>
                {currentUser.username}
              </h2>
              {currentUser.isVerified && (
                <CheckCircle2 size={18} fill="currentColor" color="var(--accent-blue)" />
              )}
            </div>

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

            <button
              onClick={() => setIsEditProfileOpen(true)}
              style={{ padding: "6px", color: "var(--text-primary)" }}
              aria-label="Profile options"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Stats Row */}
          <div
            className="profile-stats"
            style={{ display: "flex", gap: "40px", fontSize: "var(--font-size-md)" }}
          >
            <div>
              <span style={{ fontWeight: "600" }}>{myPosts.length}</span> posts
            </div>
            <div>
              <span style={{ fontWeight: "600" }}>{currentUser.followersCount.toLocaleString()}</span> followers
            </div>
            <div>
              <span style={{ fontWeight: "600" }}>{currentUser.followingCount.toLocaleString()}</span> following
            </div>
          </div>

          {/* Bio & Details */}
          <div>
            <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>
              {currentUser.fullName}
            </div>
            <div style={{ whiteSpace: "pre-line", fontSize: "var(--font-size-sm)", marginTop: "4px" }}>
              {currentUser.bio}
            </div>
            {currentUser.website && (
              <a
                href={currentUser.website}
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
                {currentUser.website}
              </a>
            )}
          </div>
        </div>
      </div>

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
          {myPosts.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
              <p style={{ fontSize: "var(--font-size-lg)", fontWeight: "600" }}>Share Photos</p>
              <p style={{ fontSize: "var(--font-size-sm)", marginTop: "8px" }}>
                When you share photos, they will appear on your profile.
              </p>
            </div>
          ) : (
            myPosts.map(post => (
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
                  alt={post.caption || "Profile post"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "saved" && (
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
                Save photos and videos that you want to see again. No one is notified, and only you can see what you've saved.
              </p>
            </div>
          ) : (
            mySavedPosts.map(post => (
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
    </div>
  );
}
