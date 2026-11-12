import React, { useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import StoriesBar from "../components/stories/StoriesBar";
import PostCard from "../components/posts/PostCard";
import RightPanel from "../components/navigation/RightPanel";
import { useApp } from "../context/AppContext";

export default function Home() {
  const {
    posts,
    feedLoading,
    loadingMoreFeed,
    feedHasMore,
    loadMoreFeed,
    setIsCreateModalOpen
  } = useApp();

  const sentinelRef = useRef(null);

  // Automatic incremental loading when scrolling near bottom of feed
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feedHasMore || loadingMoreFeed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreFeed();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [feedHasMore, loadingMoreFeed, loadMoreFeed]);

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
            <>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}

              {/* Infinite scroll sentinel & manual fallback button */}
              {feedHasMore && (
                <div
                  ref={sentinelRef}
                  style={{ padding: "20px 0", textAlign: "center" }}
                >
                  <button
                    type="button"
                    onClick={loadMoreFeed}
                    disabled={loadingMoreFeed}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--accent-gray-btn)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600",
                      color: "var(--text-primary)"
                    }}
                  >
                    {loadingMoreFeed ? "Loading more posts..." : "Load more posts"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Right Column (Suggestions & Footer) */}
      <RightPanel />
    </div>
  );
}
