import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Heart, MessageCircle, RefreshCw } from "lucide-react";
import SearchPanel from "../components/navigation/SearchPanel";
import searchService from "../services/searchService";
import MediaRenderer from "../components/shared/MediaRenderer";

export default function Search() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const locationParam = (searchParams.get("location") || "").trim();

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchLocationPosts = useCallback(async (signal) => {
    if (!locationParam) return;
    setLoading(true);
    setError("");
    try {
      const res = await searchService.searchPosts(
        { location: locationParam, page: 1, limit: 18 },
        { signal }
      );
      setPosts(Array.isArray(res?.posts) ? res.posts : []);
      setTotal(res?.total || 0);
      setHasMore(Boolean(res?.hasMore));
      setPage(1);
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      setError(err.message || "Could not load posts for this location");
    } finally {
      setLoading(false);
    }
  }, [locationParam]);

  useEffect(() => {
    if (!locationParam) return;
    const controller = new AbortController();
    fetchLocationPosts(controller.signal);
    return () => controller.abort();
  }, [locationParam, fetchLocationPosts]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !locationParam) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await searchService.searchPosts({
        location: locationParam,
        page: nextPage,
        limit: 18
      });
      const nextPosts = Array.isArray(res?.posts) ? res.posts : [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...nextPosts.filter((p) => !seen.has(p.id))];
      });
      setHasMore(Boolean(res?.hasMore));
      setPage(nextPage);
    } catch (err) {
      setError(err.message || "Failed to load more location posts");
    } finally {
      setLoadingMore(false);
    }
  };

  if (!locationParam) {
    return (
      <div className="search-inline-page">
        <SearchPanel isInline={true} />
      </div>
    );
  }

  return (
    <div className="tag-explore-page">
      <div className="tag-explore-header">
        <button
          type="button"
          className="tag-back-btn"
          onClick={() => navigate("/explore")}
          aria-label="Back to Search"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="tag-badge-circle" aria-hidden="true">
          <MapPin size={28} strokeWidth={2.1} />
        </div>

        <div className="tag-header-meta">
          <h1 className="tag-header-title">{locationParam}</h1>
          <p className="tag-header-count">
            {loading ? "Loading..." : `${total} ${total === 1 ? "post" : "posts"}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="search-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="search-retry-btn" onClick={() => fetchLocationPosts()}>
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
      ) : posts.length === 0 ? (
        <div className="explore-empty-card">
          <MapPin size={42} strokeWidth={1.5} />
          <h2>No posts found at {locationParam}</h2>
          <p>Posts tagged with this location will appear here.</p>
        </div>
      ) : (
        <>
          <div className="explore-media-grid">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/p/${post.id}`}
                className="explore-media-tile"
                aria-label={post.caption || `Post in ${locationParam}`}
              >
                <MediaRenderer
                  src={post.mediaUrl}
                  mediaType={post.mediaType}
                  alt={post.caption || locationParam}
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
      )}
    </div>
  );
}
