import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Hash, Heart, MessageCircle, Film, RefreshCw } from "lucide-react";
import searchService from "../services/searchService";
import MediaRenderer from "../components/shared/MediaRenderer";

export default function HashtagPage() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const cleanTag = decodeURIComponent(tag || "").replace(/^#/, "").trim().toLowerCase();

  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [reelsTotal, setReelsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState("posts"); // "posts" | "reels"
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchTagData = useCallback(async (signal) => {
    if (!cleanTag) return;
    setLoading(true);
    setError("");
    try {
      const [postsRes, reelsRes] = await Promise.all([
        searchService.searchPosts({ tag: cleanTag, page: 1, limit: 18 }, { signal }),
        searchService.searchReels({ tag: cleanTag, page: 1, limit: 12 }, { signal })
      ]);

      setPosts(Array.isArray(postsRes?.posts) ? postsRes.posts : []);
      setPostsTotal(postsRes?.total || 0);
      setHasMore(Boolean(postsRes?.hasMore));
      setPage(1);

      setReels(Array.isArray(reelsRes?.reels) ? reelsRes.reels : []);
      setReelsTotal(reelsRes?.total || 0);
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      setError(err.message || "Could not load hashtag results");
    } finally {
      setLoading(false);
    }
  }, [cleanTag]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTagData(controller.signal);
    return () => controller.abort();
  }, [fetchTagData]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await searchService.searchPosts({ tag: cleanTag, page: nextPage, limit: 18 });
      const nextPosts = Array.isArray(res?.posts) ? res.posts : [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...nextPosts.filter((p) => !seen.has(p.id))];
      });
      setHasMore(Boolean(res?.hasMore));
      setPage(nextPage);
    } catch (err) {
      setError(err.message || "Failed to load more posts");
    } finally {
      setLoadingMore(false);
    }
  };

  const totalCount = postsTotal + reelsTotal;

  return (
    <div className="tag-explore-page">
      <div className="tag-explore-header">
        <button
          type="button"
          className="tag-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="tag-badge-circle" aria-hidden="true">
          <Hash size={30} strokeWidth={2.2} />
        </div>

        <div className="tag-header-meta">
          <h1 className="tag-header-title">#{cleanTag}</h1>
          <p className="tag-header-count">
            {loading ? "Loading..." : `${totalCount} ${totalCount === 1 ? "post" : "posts"}`}
          </p>
        </div>
      </div>

      <div className="tag-explore-tabs" role="tablist" aria-label="Hashtag media filter">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "posts"}
          className={`tag-explore-tab ${activeTab === "posts" ? "active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          Posts ({postsTotal})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "reels"}
          className={`tag-explore-tab ${activeTab === "reels" ? "active" : ""}`}
          onClick={() => setActiveTab("reels")}
        >
          <Film size={15} />
          Reels ({reelsTotal})
        </button>
      </div>

      {error && (
        <div className="search-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="search-retry-btn" onClick={() => fetchTagData()}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="explore-media-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="explore-media-skeleton" />
          ))}
        </div>
      ) : activeTab === "posts" ? (
        posts.length === 0 ? (
          <div className="explore-empty-card">
            <Hash size={42} strokeWidth={1.5} />
            <h2>No posts found for #{cleanTag}</h2>
            <p>Public and followed posts tagged with #{cleanTag} will appear here.</p>
          </div>
        ) : (
          <>
            <div className="explore-media-grid">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/p/${post.id}`}
                  className="explore-media-tile"
                  aria-label={post.caption || `Post #${cleanTag}`}
                >
                  <MediaRenderer
                    src={post.mediaUrl}
                    mediaType={post.mediaType}
                    alt={post.caption || `#${cleanTag}`}
                    variant="grid"
                  />
                  <div className="explore-media-overlay">
                    <span>
                      <Heart size={16} fill="currentColor" />
                      {post.likesCount || 0}
                    </span>
                    <span>
                      <MessageCircle size={16} fill="currentColor" />
                      {post.commentsCount || 0}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {hasMore && (
              <div className="explore-load-more-wrap">
                <button
                  type="button"
                  className="explore-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more posts"}
                </button>
              </div>
            )}
          </>
        )
      ) : reels.length === 0 ? (
        <div className="explore-empty-card">
          <Film size={42} strokeWidth={1.5} />
          <h2>No Reels found for #{cleanTag}</h2>
          <p>Reels matching #{cleanTag} will appear here.</p>
        </div>
      ) : (
        <div className="explore-media-grid">
          {reels.map((reel) => (
            <Link
              key={reel.id}
              to={`/reels/${reel.id}`}
              className="explore-media-tile explore-reel-tile"
              aria-label={reel.caption || `Reel #${cleanTag}`}
            >
              <MediaRenderer
                src={reel.thumbnailUrl || reel.videoUrl}
                mediaType={reel.thumbnailUrl ? "image" : "video"}
                alt={reel.caption || `Reel #${cleanTag}`}
                variant="grid"
              />
              <span className="explore-reel-badge" aria-hidden="true">
                <Film size={14} />
              </span>
              <div className="explore-media-overlay">
                <span>
                  <Heart size={16} fill="currentColor" />
                  {reel.likesCount || 0}
                </span>
                <span>
                  <MessageCircle size={16} fill="currentColor" />
                  {reel.commentsCount || 0}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
