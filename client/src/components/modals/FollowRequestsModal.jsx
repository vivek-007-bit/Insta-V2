import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, UserPlus } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function FollowRequestsModal({ isOpen, onClose }) {
  const {
    followRequests,
    fetchFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest
  } = useApp();

  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchFollowRequests();
    }
  }, [isOpen, fetchFollowRequests]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAccept = async (reqId) => {
    setProcessingId(reqId);
    await acceptFollowRequest(reqId);
    setProcessingId(null);
  };

  const handleReject = async (reqId) => {
    setProcessingId(reqId);
    await rejectFollowRequest(reqId);
    setProcessingId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container"
        style={{ width: "420px", maxWidth: "94vw", maxHeight: "480px", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-post-header" style={{ padding: "12px 16px" }}>
          <div style={{ width: 24 }} />
          <h2 className="create-post-title">Follow Requests</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--text-primary)", padding: "4px" }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {followRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 12px", color: "var(--text-secondary)" }}>
              <UserPlus size={40} style={{ margin: "0 auto 10px auto", opacity: 0.6 }} />
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>
                No pending follow requests
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", marginTop: "4px" }}>
                When people request to follow your private account, you'll see them here.
              </div>
            </div>
          ) : (
            followRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px"
                }}
              >
                <Link
                  to={`/profile/${req.user.username}`}
                  onClick={onClose}
                  style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}
                >
                  <img
                    src={req.user.avatar}
                    alt={req.user.username}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                      border: "1px solid var(--border-subtle)"
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "var(--font-size-sm)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {req.user.username}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {req.user.fullName}
                    </div>
                  </div>
                </Link>

                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleAccept(req.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--accent-blue)",
                      color: "#ffffff",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600",
                      opacity: processingId === req.id ? 0.6 : 1
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleReject(req.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--accent-gray-btn)",
                      color: "var(--text-primary)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "600",
                      opacity: processingId === req.id ? 0.6 : 1
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
