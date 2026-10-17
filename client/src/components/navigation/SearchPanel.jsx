import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, X, CheckCircle2 } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function SearchPanel({ isInline = false }) {
  const {
    isSearchOpen,
    setIsSearchOpen,
    suggestedUsers,
    currentUser,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearAllRecentSearches
  } = useApp();

  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  // All searchable users pool
  const allUsers = [
    currentUser,
    ...suggestedUsers,
    {
      id: "u_tokyo",
      username: "tokyo_vibes",
      fullName: "Tokyo Street Aesthetics",
      avatar: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=150&auto=format&fit=crop&q=80",
      isVerified: true
    },
    {
      id: "u_coffee",
      username: "barista_journal",
      fullName: "Artisan Coffee Culture",
      avatar: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=150&auto=format&fit=crop&q=80",
      isVerified: false
    }
  ];

  // Auto focus input when opened
  useEffect(() => {
    if (isSearchOpen || isInline) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
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

  if (!isSearchOpen && !isInline) return null;

  // Filtered results
  const filteredUsers = query.trim()
    ? allUsers.filter(
        u =>
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.fullName.toLowerCase().includes(query.toLowerCase())
      )
    : [];

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
              placeholder="Search"
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
            /* Recent Searches Section */
            <div>
              <div className="search-section-header">
                <span className="search-section-title">Recent</span>
                {recentSearches.length > 0 && (
                  <button
                    className="search-clear-all-btn"
                    onClick={clearAllRecentSearches}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {recentSearches.length === 0 ? (
                <div className="search-empty-state">
                  <p style={{ fontWeight: "600", fontSize: "var(--font-size-sm)" }}>No recent searches.</p>
                </div>
              ) : (
                <div className="search-results-list">
                  {recentSearches.map(user => (
                    <div
                      key={user.id || user.username}
                      className="search-result-item"
                    >
                      <Link
                        to="/profile"
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Live Filtered Results */
            <div>
              {filteredUsers.length === 0 ? (
                <div className="search-empty-state">
                  <p style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>No results found.</p>
                  <p style={{ fontSize: "var(--font-size-xs)" }}>
                    Try searching for a different username or display name.
                  </p>
                </div>
              ) : (
                <div className="search-results-list">
                  {filteredUsers.map(user => (
                    <Link
                      key={user.id || user.username}
                      to="/profile"
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
