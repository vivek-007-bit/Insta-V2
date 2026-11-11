import React from "react";
import { Camera } from "lucide-react";
import StoriesBar from "../components/stories/StoriesBar";
import PostCard from "../components/posts/PostCard";
import RightPanel from "../components/navigation/RightPanel";
import { useApp } from "../context/AppContext";

export default function Home() {
  const { posts, feedLoading, setIsCreateModalOpen } = useApp();

  return (
    <div className="main-container">
      {/* Center Column */}
      <section className="feed-column">
        {/* Stories Bar */}
        <StoriesBar />

        {/* Posts Feed */}
        <div className="posts-feed" style={{ display: "flex", flexDirection: "column" }}>
          {feedLoading && posts.length === 0 ? (
            <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
              Loading feed...
            </div>
          ) : posts.length === 0 ? (
            <div
              style={{
                padding: "56px 24px",
                textAlign: "center",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-elevated)",
                marginTop: "12px"
              }}
            >
              <Camera size={44} strokeWidth={1.5} style={{ margin: "0 auto 12px auto", color: "var(--text-secondary)" }} />
              <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: "600" }}>
                Welcome to Insta-V2
              </h3>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginTop: "6px", marginBottom: "18px" }}>
                Follow accounts or share your first photo to see posts in your feed.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  backgroundColor: "var(--accent-blue)",
                  color: "#ffffff",
                  padding: "8px 18px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: "600"
                }}
              >
                Create your first post
              </button>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </section>

      {/* Right Column (Suggestions & Footer) */}
      <RightPanel />
    </div>
  );
}
