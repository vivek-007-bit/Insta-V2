import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  Hash,
  MapPin,
  Lock,
  Film,
  Heart,
  MessageCircle,
  RefreshCw,
  Clock
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import searchService from "../../services/searchService";
import FollowButton from "../shared/FollowButton";

const SEARCH_TABS = [
  { id: "all", label: "Top" },
  { id: "accounts", label: "Accounts" },
  { id: "tags", label: "Tags" },
  { id: "places", label: "Places" }
];

const EMPTY_RESULTS = {
  users: [],
  hashtags: [],
  places: [],
  posts: [],
  reels: [],
  usersHasMore: false,
  usersPage: 1
};

export default function SearchPanel({ isInline = false }) {
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    searchCategory,
    setSearchCategory,
    recentSearches,
    recentSearchesLoading,
    addRecentSearch,
    removeRecentSearch,
    clearAllRecentSearches,
    suggestedUsers
  } = useApp();

  const navigate = useNavigate();
  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  const abortRef = useRef(null);

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery.trim());
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryToken, setRetryToken] = useState(0);

  const isVisible = isInline || isSearchOpen;
  const trimmedQuery = searchQuery.trim();

  // Sync focus when flyout opens
  useEffect(() => {
    if (isSearchOpen && !isInline) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen, isInline]);

  // Global keyboard shortcuts (Ctrl+K / Cmd+K to open/focus, Escape to close)
  useEffect(() => {
    if (isInline) return undefined;

    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const inlineInput = document.querySelector(".search-inline-page .search-input-field");
        if (inlineInput) {
          inlineInput.focus();
          return;
        }
        setIsSearchOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 40);
      } else if (e.key === "Escape" && isSearchOpen) {
        e.preventDefault();
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isInline, isSearchOpen, setIsSearchOpen]);

  // Debounce query by 300ms
  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(clean);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleQueryChange = (nextVal) => {
    setSearchQuery(nextVal);
    if (!nextVal.trim()) {
      setDebouncedQuery("");
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setError("");
      setActiveIndex(-1);
    }
  };

  // Perform search when debounced query or category changes while panel is visible
  useEffect(() => {
    if (!isVisible || !debouncedQuery) return undefined;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const runSearch = async () => {
      setLoading(true);
      setError("");
      setActiveIndex(-1);

      try {
        if (searchCategory === "accounts") {
          const res = await searchService.searchUsers(debouncedQuery, 1, 20, {
            signal: controller.signal
          });
          setResults({
            ...EMPTY_RESULTS,
            users: Array.isArray(res?.users) ? res.users : [],
            usersHasMore: Boolean(res?.hasMore),
            usersPage: 1
          });
        } else if (searchCategory === "tags") {
          const res = await searchService.searchHashtags(debouncedQuery, 20, {
            signal: controller.signal
          });
          setResults({
            ...EMPTY_RESULTS,
            hashtags: Array.isArray(res?.hashtags) ? res.hashtags : []
          });
        } else if (searchCategory === "places") {
          const res = await searchService.searchPlaces(debouncedQuery, 15, {
            signal: controller.signal
          });
          setResults({
            ...EMPTY_RESULTS,
            places: Array.isArray(res?.places) ? res.places : []
          });
        } else {
          const res = await searchService.globalSearch(debouncedQuery, "all", 12, {
            signal: controller.signal
          });
          setResults({
            users: Array.isArray(res?.users) ? res.users : [],
            hashtags: Array.isArray(res?.hashtags) ? res.hashtags : [],
            places: Array.isArray(res?.places) ? res.places : [],
            posts: Array.isArray(res?.posts) ? res.posts : [],
            reels: Array.isArray(res?.reels) ? res.reels : [],
            usersHasMore: false,
            usersPage: 1
          });
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return;
        }
        setError(err.message || "Search failed. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, searchCategory, isVisible, retryToken]);

  const handleLoadMoreUsers = async () => {
    if (loadingMoreUsers || !results.usersHasMore || !debouncedQuery) return;
    setLoadingMoreUsers(true);
    const nextPage = results.usersPage + 1;
    try {
      const res = await searchService.searchUsers(debouncedQuery, nextPage, 20);
      const nextUsers = Array.isArray(res?.users) ? res.users : [];
      setResults((prev) => {
        const seen = new Set(prev.users.map((u) => u.id));
        return {
          ...prev,
          users: [...prev.users, ...nextUsers.filter((u) => !seen.has(u.id))],
          usersHasMore: Boolean(res?.hasMore),
          usersPage: nextPage
        };
      });
    } catch (err) {
      setError(err.message || "Failed to load more accounts");
    } finally {
      setLoadingMoreUsers(false);
    }
  };

  const closeIfFlyout = useCallback(() => {
    if (!isInline) {
      setIsSearchOpen(false);
    }
  }, [isInline, setIsSearchOpen]);

  const handleSelectUser = useCallback(
    (user) => {
      if (!user?.username) return;
      addRecentSearch({ type: "user", targetUser: user });
      closeIfFlyout();
      navigate(`/profile/${encodeURIComponent(user.username)}`);
    },
    [addRecentSearch, closeIfFlyout, navigate]
  );

  const handleSelectHashtag = useCallback(
    (tag) => {
      const cleanTag = String(tag || "").replace(/^#+/, "").trim().toLowerCase();
      if (!cleanTag) return;
      addRecentSearch({ type: "hashtag", hashtag: cleanTag });
      closeIfFlyout();
      navigate(`/tags/${encodeURIComponent(cleanTag)}`);
    },
    [addRecentSearch, closeIfFlyout, navigate]
  );

  const handleSelectPlace = useCallback(
    (locationName) => {
      const cleanLoc = String(locationName || "").trim();
      if (!cleanLoc) return;
      addRecentSearch({ type: "place", location: cleanLoc });
      closeIfFlyout();
      navigate(`/explore?location=${encodeURIComponent(cleanLoc)}`);
    },
    [addRecentSearch, closeIfFlyout, navigate]
  );

  const handleSelectPost = useCallback(
    (post) => {
      if (!post?.id) return;
      if (trimmedQuery) {
        addRecentSearch({ type: "query", query: trimmedQuery });
      }
      closeIfFlyout();
      navigate(`/p/${encodeURIComponent(post.id)}`);
    },
    [addRecentSearch, closeIfFlyout, navigate, trimmedQuery]
  );

  const handleSelectReel = useCallback(
    (reel) => {
      if (!reel?.id) return;
      if (trimmedQuery) {
        addRecentSearch({ type: "query", query: trimmedQuery });
      }
      closeIfFlyout();
      navigate(`/reels/${encodeURIComponent(reel.id)}`);
    },
    [addRecentSearch, closeIfFlyout, navigate, trimmedQuery]
  );

  const handleSelectRecent = useCallback(
    (item) => {
      if (!item) return;
      if (item.type === "hashtag" && item.hashtag) {
        handleSelectHashtag(item.hashtag);
      } else if (item.type === "place" && item.location) {
        handleSelectPlace(item.location);
      } else if (item.type === "query" && item.query) {
        setSearchQuery(item.query);
        setDebouncedQuery(item.query);
        addRecentSearch({ type: "query", query: item.query });
        inputRef.current?.focus();
      } else if (item.targetUser?.username) {
        handleSelectUser(item.targetUser);
      }
    },
    [addRecentSearch, handleSelectHashtag, handleSelectPlace, handleSelectUser, setSearchQuery]
  );

  // Build ordered navigable items for ArrowUp/ArrowDown/Enter keyboard selection
  const keyboardItems = useMemo(() => {
    const items = [];
    if (!trimmedQuery) {
      recentSearches.forEach((item) => {
        items.push({ kind: "recent", payload: item });
      });
      suggestedUsers.forEach((u) => {
        items.push({ kind: "user", payload: u });
      });
      return items;
    }

    if (searchCategory === "all" || searchCategory === "accounts") {
      results.users.forEach((u) => items.push({ kind: "user", payload: u }));
    }
    if (searchCategory === "all" || searchCategory === "tags") {
      results.hashtags.forEach((h) => items.push({ kind: "hashtag", payload: h.tag }));
    }
    if (searchCategory === "all" || searchCategory === "places") {
      results.places.forEach((p) => items.push({ kind: "place", payload: p.name }));
    }
    if (searchCategory === "all") {
      results.posts.forEach((p) => items.push({ kind: "post", payload: p }));
      results.reels.forEach((r) => items.push({ kind: "reel", payload: r }));
    }
    return items;
  }, [trimmedQuery, recentSearches, suggestedUsers, searchCategory, results]);

  const activateKeyboardItem = useCallback(
    (entry) => {
      if (!entry) return;
      if (entry.kind === "recent") handleSelectRecent(entry.payload);
      else if (entry.kind === "user") handleSelectUser(entry.payload);
      else if (entry.kind === "hashtag") handleSelectHashtag(entry.payload);
      else if (entry.kind === "place") handleSelectPlace(entry.payload);
      else if (entry.kind === "post") handleSelectPost(entry.payload);
      else if (entry.kind === "reel") handleSelectReel(entry.payload);
    },
    [
      handleSelectHashtag,
      handleSelectPlace,
      handleSelectPost,
      handleSelectRecent,
      handleSelectReel,
      handleSelectUser
    ]
  );

  // Sync active item into view when using Arrow keys
  useEffect(() => {
    if (activeIndex < 0 || !bodyRef.current) return;
    const el = bodyRef.current.querySelector(`[data-search-index="${activeIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const handleInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      if (keyboardItems.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % keyboardItems.length);
    } else if (e.key === "ArrowUp") {
      if (keyboardItems.length === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? keyboardItems.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && keyboardItems[activeIndex]) {
        e.preventDefault();
        activateKeyboardItem(keyboardItems[activeIndex]);
      } else if (trimmedQuery) {
        e.preventDefault();
        if (trimmedQuery.startsWith("#") && trimmedQuery.length > 1 && searchCategory === "tags") {
          handleSelectHashtag(trimmedQuery);
        } else {
          setDebouncedQuery(trimmedQuery);
          addRecentSearch({ type: "query", query: trimmedQuery });
        }
      }
    } else if (e.key === "Escape") {
      if (!isInline) {
        e.preventDefault();
        setIsSearchOpen(false);
      } else if (searchQuery) {
        e.preventDefault();
        setSearchQuery("");
      }
    }
  };

  const hasAnyResults =
    results.users.length > 0 ||
    results.hashtags.length > 0 ||
    results.places.length > 0 ||
    results.posts.length > 0 ||
    results.reels.length > 0;

  // Deterministic section offsets for keyboard navigation without mutating variables during render
  const suggestedStartIndex = recentSearches.length;
  const usersCount = searchCategory === "all" || searchCategory === "accounts" ? results.users.length : 0;
  const tagsCount = searchCategory === "all" || searchCategory === "tags" ? results.hashtags.length : 0;
  const placesCount = searchCategory === "all" || searchCategory === "places" ? results.places.length : 0;
  const postsCount = searchCategory === "all" ? results.posts.length : 0;

  const usersStartIndex = 0;
  const tagsStartIndex = usersCount;
  const placesStartIndex = usersCount + tagsCount;
  const postsStartIndex = usersCount + tagsCount + placesCount;
  const reelsStartIndex = usersCount + tagsCount + placesCount + postsCount;

  const renderSkeletons = (count = 5) => (
    <div className="search-skeleton-list" aria-busy="true" aria-label="Loading search results">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="search-skeleton-row">
          <div className="search-skeleton-avatar" />
          <div className="search-skeleton-lines">
            <div className="search-skeleton-line short" />
            <div className="search-skeleton-line long" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderUserRow = (user, navIdx, { showFollowButton = false, showSubtitle = false } = {}) => {
    const subtitleText =
      showSubtitle && user.subtitle
        ? user.subtitle
        : user.fullName || `@${user.username}`;

    return (
      <div
        key={user.id || user.username}
        role="option"
        tabIndex={0}
        aria-selected={activeIndex === navIdx}
        data-search-index={navIdx}
        className={`search-result-item ${activeIndex === navIdx ? "is-active" : ""}`}
        onClick={() => handleSelectUser(user)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelectUser(user);
          }
        }}
      >
        <div className="search-user-info">
          <img
            src={user.avatar}
            alt={user.username}
            className="search-user-avatar"
          />
          <div className="search-user-names">
            <div className="search-username-row">
              <span className="search-username">{user.username}</span>
              {user.isPrivate && (
                <Lock size={12} className="search-private-badge" aria-label="Private account" />
              )}
              {!showFollowButton && user.isFollowing && (
                <span className="search-relation-pill">Following</span>
              )}
            </div>
            <span className="search-fullname">{subtitleText}</span>
          </div>
        </div>

        {showFollowButton && (
          <div className="search-row-action" onClick={(e) => e.stopPropagation()}>
            <FollowButton user={user} className="search-follow-btn" />
          </div>
        )}
      </div>
    );
  };

  const renderRecentRow = (item, navIdx) => {
    let iconOrAvatar = null;
    let title = "";
    let subtitle = "";

    if (item.type === "hashtag") {
      iconOrAvatar = (
        <div className="search-entity-badge" aria-hidden="true">
          <Hash size={18} />
        </div>
      );
      title = `#${item.hashtag}`;
      subtitle = "Hashtag";
    } else if (item.type === "place") {
      iconOrAvatar = (
        <div className="search-entity-badge" aria-hidden="true">
          <MapPin size={18} />
        </div>
      );
      title = item.location;
      subtitle = "Place";
    } else if (item.type === "query") {
      iconOrAvatar = (
        <div className="search-entity-badge" aria-hidden="true">
          <Clock size={18} />
        </div>
      );
      title = item.query;
      subtitle = "Recent search";
    } else if (item.targetUser) {
      iconOrAvatar = (
        <img
          src={item.targetUser.avatar}
          alt={item.targetUser.username}
          className="search-user-avatar"
        />
      );
      title = item.targetUser.username;
      subtitle = item.targetUser.fullName || "Account";
    } else {
      return null;
    }

    return (
      <div
        key={item.id || `${item.type}-${title}`}
        role="option"
        tabIndex={0}
        aria-selected={activeIndex === navIdx}
        data-search-index={navIdx}
        className={`search-result-item ${activeIndex === navIdx ? "is-active" : ""}`}
        onClick={() => handleSelectRecent(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelectRecent(item);
          }
        }}
      >
        <div className="search-user-info">
          {iconOrAvatar}
          <div className="search-user-names">
            <div className="search-username-row">
              <span className="search-username">{title}</span>
              {item.targetUser?.isPrivate && (
                <Lock size={12} className="search-private-badge" aria-label="Private account" />
              )}
            </div>
            <span className="search-fullname">{subtitle}</span>
          </div>
        </div>
        <button
          type="button"
          className="search-delete-recent-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            removeRecentSearch(item.id || item.targetUser?.username);
          }}
          aria-label={`Remove ${title} from recent searches`}
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  const panelBody = (
    <div
      className={isInline ? "search-inline-panel" : "search-flyout-panel"}
      onClick={(e) => e.stopPropagation()}
      role={isInline ? undefined : "dialog"}
      aria-label="Search Insta-V2"
    >
      {/* Header & Input */}
      <div className="search-panel-header">
        <div className="search-title-row">
          <h2 className="search-panel-title">Search</h2>
          {!isInline && (
            <button
              type="button"
              className="search-panel-close-btn"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Close search panel"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="search-input-box">
          <Search size={16} className="search-input-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="search-input-field"
            aria-label="Search accounts, hashtags, posts, reels, and places"
            aria-autocomplete="list"
          />
          {!searchQuery && (
            <span className="search-shortcut-hint" aria-hidden="true">
              Ctrl K
            </span>
          )}
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                handleQueryChange("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="search-category-tabs" role="tablist" aria-label="Search categories">
          {SEARCH_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={searchCategory === tab.id}
              className={`search-category-tab ${searchCategory === tab.id ? "active" : ""}`}
              onClick={() => {
                setSearchCategory(tab.id);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results & Discovery Body */}
      <div className="search-panel-body" ref={bodyRef} role="listbox" aria-label="Search results">
        {error && (
          <div className="search-error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="search-retry-btn"
              onClick={() => setRetryToken((t) => t + 1)}
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {trimmedQuery === "" ? (
          /* Empty Query: Recent Searches + Suggested Accounts */
          <div className="search-discovery-sections">
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">Recent</h3>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    className="search-clear-all-btn"
                    onClick={clearAllRecentSearches}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {recentSearchesLoading && recentSearches.length === 0 ? (
                renderSkeletons(3)
              ) : recentSearches.length === 0 ? (
                <p className="search-recent-empty-text">No recent searches.</p>
              ) : (
                <div className="search-results-list">
                  {recentSearches.map((item, idx) => renderRecentRow(item, idx))}
                </div>
              )}
            </div>

            {suggestedUsers.length > 0 && (
              <div className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Suggested for you</h3>
                </div>
                <div className="search-results-list">
                  {suggestedUsers.map((user, idx) =>
                    renderUserRow(user, suggestedStartIndex + idx, {
                      showFollowButton: true,
                      showSubtitle: true
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          renderSkeletons(6)
        ) : !hasAnyResults ? (
          <div className="search-empty-state">
            <Search size={36} strokeWidth={1.4} className="search-empty-icon" />
            <p className="search-empty-title">No results found.</p>
            <span className="search-empty-subtitle">
              Try searching for a username, #hashtag, post caption, or place.
            </span>
          </div>
        ) : (
          <div className="search-grouped-results">
            {/* Accounts Section */}
            {(searchCategory === "all" || searchCategory === "accounts") &&
              results.users.length > 0 && (
                <div className="search-section">
                  {searchCategory === "all" && (
                    <div className="search-section-header">
                      <h3 className="search-section-title">Accounts</h3>
                      <button
                        type="button"
                        className="search-clear-all-btn"
                        onClick={() => setSearchCategory("accounts")}
                      >
                        See all
                      </button>
                    </div>
                  )}
                  <div className="search-results-list">
                    {results.users.map((u, idx) =>
                      renderUserRow(u, usersStartIndex + idx, {
                        showFollowButton: searchCategory === "accounts",
                        showSubtitle: false
                      })
                    )}
                  </div>
                  {searchCategory === "accounts" && results.usersHasMore && (
                    <button
                      type="button"
                      className="search-load-more-btn"
                      onClick={handleLoadMoreUsers}
                      disabled={loadingMoreUsers}
                    >
                      {loadingMoreUsers ? "Loading..." : "Load more accounts"}
                    </button>
                  )}
                </div>
              )}

            {/* Hashtags Section */}
            {(searchCategory === "all" || searchCategory === "tags") &&
              results.hashtags.length > 0 && (
                <div className="search-section">
                  {searchCategory === "all" && (
                    <div className="search-section-header">
                      <h3 className="search-section-title">Tags</h3>
                      <button
                        type="button"
                        className="search-clear-all-btn"
                        onClick={() => setSearchCategory("tags")}
                      >
                        See all
                      </button>
                    </div>
                  )}
                  <div className="search-results-list">
                    {results.hashtags.map((h, idx) => {
                      const navIdx = tagsStartIndex + idx;
                      return (
                        <div
                          key={h.tag}
                          role="option"
                          tabIndex={0}
                          aria-selected={activeIndex === navIdx}
                          data-search-index={navIdx}
                          className={`search-result-item ${activeIndex === navIdx ? "is-active" : ""}`}
                          onClick={() => handleSelectHashtag(h.tag)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectHashtag(h.tag);
                            }
                          }}
                        >
                          <div className="search-user-info">
                            <div className="search-entity-badge" aria-hidden="true">
                              <Hash size={18} />
                            </div>
                            <div className="search-user-names">
                              <span className="search-username">#{h.tag}</span>
                              <span className="search-fullname">
                                {h.postsCount} {h.postsCount === 1 ? "post" : "posts"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Places Section */}
            {(searchCategory === "all" || searchCategory === "places") &&
              results.places.length > 0 && (
                <div className="search-section">
                  {searchCategory === "all" && (
                    <div className="search-section-header">
                      <h3 className="search-section-title">Places</h3>
                      <button
                        type="button"
                        className="search-clear-all-btn"
                        onClick={() => setSearchCategory("places")}
                      >
                        See all
                      </button>
                    </div>
                  )}
                  <div className="search-results-list">
                    {results.places.map((place, idx) => {
                      const navIdx = placesStartIndex + idx;
                      return (
                        <div
                          key={place.name}
                          role="option"
                          tabIndex={0}
                          aria-selected={activeIndex === navIdx}
                          data-search-index={navIdx}
                          className={`search-result-item ${activeIndex === navIdx ? "is-active" : ""}`}
                          onClick={() => handleSelectPlace(place.name)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectPlace(place.name);
                            }
                          }}
                        >
                          <div className="search-user-info">
                            <div className="search-entity-badge" aria-hidden="true">
                              <MapPin size={18} />
                            </div>
                            <div className="search-user-names">
                              <span className="search-username">{place.name}</span>
                              <span className="search-fullname">
                                {place.postsCount} {place.postsCount === 1 ? "post" : "posts"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Posts Section (Top tab) */}
            {searchCategory === "all" && results.posts.length > 0 && (
              <div className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Posts</h3>
                </div>
                <div className="search-media-list">
                  {results.posts.map((post, idx) => {
                    const navIdx = postsStartIndex + idx;
                    return (
                      <div
                        key={post.id}
                        role="option"
                        tabIndex={0}
                        aria-selected={activeIndex === navIdx}
                        data-search-index={navIdx}
                        className={`search-media-row ${activeIndex === navIdx ? "is-active" : ""}`}
                        onClick={() => handleSelectPost(post)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectPost(post);
                          }
                        }}
                      >
                        <div className="search-media-thumb-wrap">
                          {post.mediaType === "video" ? (
                            <video src={post.mediaUrl} className="search-media-thumb" muted playsInline />
                          ) : (
                            <img src={post.mediaUrl} alt={post.caption || "Post"} className="search-media-thumb" />
                          )}
                        </div>
                        <div className="search-media-meta">
                          <span className="search-media-author">@{post.username}</span>
                          <p className="search-media-caption">
                            {post.caption || post.location || "View post"}
                          </p>
                          <span className="search-media-stats">
                            <Heart size={11} /> {post.likesCount || 0}
                            <MessageCircle size={11} /> {post.commentsCount || 0}
                            {post.location ? ` · ${post.location}` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reels Section (Top tab) */}
            {searchCategory === "all" && results.reels.length > 0 && (
              <div className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Reels</h3>
                </div>
                <div className="search-media-list">
                  {results.reels.map((reel, idx) => {
                    const navIdx = reelsStartIndex + idx;
                    return (
                      <div
                        key={reel.id}
                        role="option"
                        tabIndex={0}
                        aria-selected={activeIndex === navIdx}
                        data-search-index={navIdx}
                        className={`search-media-row ${activeIndex === navIdx ? "is-active" : ""}`}
                        onClick={() => handleSelectReel(reel)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectReel(reel);
                          }
                        }}
                      >
                        <div className="search-media-thumb-wrap">
                          {reel.thumbnailUrl ? (
                            <img src={reel.thumbnailUrl} alt={reel.caption || "Reel"} className="search-media-thumb" />
                          ) : (
                            <video src={reel.videoUrl} className="search-media-thumb" muted playsInline />
                          )}
                          <span className="search-reel-icon-badge" aria-hidden="true">
                            <Film size={11} />
                          </span>
                        </div>
                        <div className="search-media-meta">
                          <span className="search-media-author">@{reel.username}</span>
                          <p className="search-media-caption">
                            {reel.caption || reel.audioTrack || "Watch Reel"}
                          </p>
                          <span className="search-media-stats">
                            <Heart size={11} /> {reel.likesCount || 0}
                            <MessageCircle size={11} /> {reel.commentsCount || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return panelBody;
  }

  return (
    <div
      className={`search-panel-overlay ${isSearchOpen ? "is-open" : "is-closed"}`}
      aria-hidden={!isSearchOpen}
      onClick={() => setIsSearchOpen(false)}
    >
      {panelBody}
    </div>
  );
}
