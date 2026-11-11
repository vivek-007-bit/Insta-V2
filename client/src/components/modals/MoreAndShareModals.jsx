import React, { useEffect } from "react";
import { X, Share2, Link as LinkIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import postService from "../../services/postService";

export function MoreOptionsModal() {
  const { moreOptionsPost, setMoreOptionsPost, showToast, toggleSavePost } = useApp();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && moreOptionsPost) {
        setMoreOptionsPost(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moreOptionsPost, setMoreOptionsPost]);

  if (!moreOptionsPost) return null;

  const handleClose = () => setMoreOptionsPost(null);

  const handleCopyLink = async () => {
    try {
      const res = await postService.getPostShareInfo(moreOptionsPost.id);
      const postUrl = res.shareUrl || `${window.location.origin}/p/${moreOptionsPost.id}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        showToast("Link copied to clipboard");
      } else {
        showToast(`Link: ${postUrl}`);
      }
    } catch (err) {
      showToast(err.message || "Unable to copy link for this post");
    }
    handleClose();
  };

  const handleNativeShare = async () => {
    try {
      const res = await postService.getPostShareInfo(moreOptionsPost.id);
      const postUrl = res.shareUrl || `${window.location.origin}/p/${moreOptionsPost.id}`;
      if (navigator.share) {
        await navigator.share({
          title: res.title,
          text: res.text,
          url: postUrl
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        showToast("Link copied to clipboard");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        showToast(err.message || "Unable to share this post");
      }
    }
    handleClose();
  };

  const handleBookmark = () => {
    toggleSavePost(moreOptionsPost.id);
    handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-container options-modal" onClick={(e) => e.stopPropagation()}>
        <button className="options-btn" onClick={handleBookmark}>
          {moreOptionsPost.isSaved ? "Remove from Saved" : "Save to Collection"}
        </button>
        <button className="options-btn" onClick={handleNativeShare}>
          Share to...
        </button>
        <button className="options-btn" onClick={handleCopyLink}>
          Copy link
        </button>
        <button className="options-btn" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ShareDialogModal() {
  const { shareDialogPost, setShareDialogPost, showToast } = useApp();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && shareDialogPost) {
        setShareDialogPost(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shareDialogPost, setShareDialogPost]);

  if (!shareDialogPost) return null;

  const handleClose = () => setShareDialogPost(null);
  const postUrl = `${window.location.origin}/p/${shareDialogPost.id}`;

  const handleCopyLink = async () => {
    try {
      const res = await postService.getPostShareInfo(shareDialogPost.id);
      const url = res.shareUrl || postUrl;
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch (err) {
      showToast(err.message || "Unable to share this post");
    }
  };

  const handleWebShare = async () => {
    try {
      const res = await postService.getPostShareInfo(shareDialogPost.id);
      const url = res.shareUrl || postUrl;
      if (navigator.share) {
        await navigator.share({
          title: res.title,
          text: res.text,
          url
        });
        handleClose();
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Web Share not supported here — link copied to clipboard!");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        showToast(err.message || "Unable to share this post");
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
      <div
        className="modal-container"
        style={{ width: "400px", maxWidth: "92vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-post-header">
          <div style={{ width: 20 }} />
          <h2 className="create-post-title">Share Post</h2>
          <button
            className="modal-close-x"
            style={{ position: "static", color: "var(--text-primary)" }}
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-secondary)",
              fontSize: "var(--font-size-xs)",
              color: "var(--text-secondary)",
              wordBreak: "break-all"
            }}
          >
            {postUrl}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-gray-btn)",
                fontSize: "var(--font-size-sm)",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <LinkIcon size={16} />
              <span>Copy link</span>
            </button>

            <button
              type="button"
              onClick={handleWebShare}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-blue)",
                color: "#ffffff",
                fontSize: "var(--font-size-sm)",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <Share2 size={16} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
