import React from "react";
import { Bookmark } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Saved() {
  const { posts, savedPostIds, setSelectedPostDetail } = useApp();

  const savedPosts = posts.filter(p => savedPostIds.has(p.id));

  return (
    <div style={{ width: "100%", maxWidth: "935px", padding: "30px 20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "var(--font-size-xl)", fontWeight: "600" }}>Saved Posts</h1>
        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "4px" }}>
          Only you can see what you've saved
        </p>
      </div>

      {savedPosts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-secondary)" }}>
          <Bookmark size={52} strokeWidth={1.5} style={{ margin: "0 auto 16px auto" }} />
          <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "600", color: "var(--text-primary)" }}>
            Save Photos and Videos
          </h2>
          <p style={{ fontSize: "var(--font-size-sm)", maxWidth: "340px", margin: "8px auto 0 auto" }}>
            Save items that you want to see again. Click the bookmark icon on any post to save it here.
          </p>
        </div>
      ) : (
        <div
          className="media-posts-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "28px"
          }}
        >
          {savedPosts.map(post => (
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
          ))}
        </div>
      )}
    </div>
  );
}
