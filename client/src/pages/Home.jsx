import React from "react";
import StoriesBar from "../components/stories/StoriesBar";
import PostCard from "../components/posts/PostCard";
import RightPanel from "../components/navigation/RightPanel";
import { useApp } from "../context/AppContext";

export default function Home() {
  const { posts } = useApp();

  return (
    <div className="main-container">
      {/* Center Column */}
      <section className="feed-column">
        {/* Stories Bar */}
        <StoriesBar />

        {/* Posts Feed */}
        <div className="posts-feed" style={{ display: "flex", flexDirection: "column" }}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>

      {/* Right Column (Suggestions & Footer) */}
      <RightPanel />
    </div>
  );
}
