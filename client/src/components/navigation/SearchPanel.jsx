import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, X, CheckCircle2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import userService from "../../services/userService";

export default function SearchPanel({ isInline = false }) {
  const {
    isSearchOpen,
    setIsSearchOpen,
    suggestedUsers,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearAllRecentSearches
  } = useApp();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  // Auto focus input when opened
  useEffect(() => {
    if (isSearchOpen || isInline) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setSearchResults([]);
    }
  }, [isSearchOpen, isInline]);

  // Escape key closes search panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isSearchOpen && !isInline) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, isInline, setIsSearchOpen]);

  // Fetch real users from backend when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    let isCancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await userService.searchUsers(trimmed, 20);
        if (!isCancelled && res && Array.isArray(res.users)) {
          setSearchResults(res.users);
        }
      } catch {
        if (!isCancelled) setSearchResults([]);
      } finally {
        if (!isCancelled) setSearching(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!isSearchOpen && !isInline) return null;

  const handleSelectUser = (user) => {
    addRecentSearch(user);
    if (!isInline) {
      setIsSearchOpen(false);
    }
  };

  return (
    <>
      {!isInline && (
        <div
          className="search-panel-overlay"
          onClick={() => setIsSearchOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={isInline ? "search-inline-container" : "search-flyout-panel"}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search"
      >
        <div className="search-panel-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="search-panel-title">Search</h2>
            {!isInline && (
              <button
                onClick={() => setIsSearchOpen(false)}
                style={{ color: "var(--text-secondary)", padding: "4px" }}
                aria-label="Close search"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className="search-input-box">
            <SearchIcon size={16} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input-field"
              aria-label="Search input"
            />
            {query && (
              <button
                className="search-clear-btn"
                onClick={() => setQuery("")}
                aria-label="Clear input"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="search-panel-body">
          {query.trim() === "" ? (
            /* Recent & Suggested Users Section */
            <div>
              <div className="search-section-header">
                <span className="search-section-title">
                  {recentSearches.length > 0 ? "Recent" : "People on Insta-V2"}
                </span>
                {recentSearches.length > 0 && (
                  <button
                    className="search-clear-all-btn"
                    onClick={clearAllRecentSearches}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {recentSearches.length === 0 && suggestedUsers.length === 0 ? (
                <div className="search-empty-state">
                  <p style={{ fontWeight: "600", fontSize: "var(--font-size-sm)" }}>No recent searches.</p>
                </div>
              ) : (
                <div className="search-results-list">
                  {(recentSearches.length > 0 ? recentSearches : suggestedUsers).map((user) => (
                    <div
                      key={user.id || user.username}
                      className="search-result-item"
                    >
                      <Link
                        to={`/profile/${user.username}`}
                        className="search-user-info"
                        onClick={() => handleSelectUser(user)}
                      >
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="search-user-avatar"
                        />
                        <div className="search-user-names">
                          <div className="search-username-row">
                            <span className="search-username">{user.username}</span>
                            {user.isVerified && (
                              <CheckCircle2 size={12} fill="currentColor" color="var(--accent-blue)" />
                            )}
                          </div>
                          <span className="search-fullname">{user.fullName}</span>
                        </div>
                      </Link>

                      {recentSearches.length > 0 && (
                        <button
                          className="search-delete-recent-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(user.username);
                          }}
                          aria-label={`Remove ${user.username} from recent`}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Live Database Search Results */
            <div>
              {searching ? (
                <div className="search-empty-state">
                  <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                    Searching...
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="search-empty-state">
                  <p style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>No results found.</p>
                  <p style={{ fontSize: "var(--font-size-xs)" }}>
                    Try searching for a different username or display name.
                  </p>
                </div>
              ) : (
                <div className="search-results-list">
                  {searchResults.map((user) => (
                    <Link
                      key={user.id || user.username}
                      to={`/profile/${user.username}`}
                      className="search-result-item"
                      onClick={() => handleSelectUser(user)}
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
                            {user.isVerified && (
                              <CheckCircle2 size={12} fill="currentColor" color="var(--accent-blue)" />
                            )}
                          </div>
                          <span className="search-fullname">{user.fullName}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
