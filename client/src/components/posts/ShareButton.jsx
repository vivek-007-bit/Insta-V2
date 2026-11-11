import React, { useState } from "react";
import { Send } from "lucide-react";
import postService from "../../services/postService";
import { useApp } from "../../context/AppContext";

export default function ShareButton({ post, className = "post-action-btn", size = 24 }) {
  const { showToast } = useApp();
  const [sharing, setSharing] = useState(false);

  const handleShare = async (e) => {
    e?.stopPropagation();
    if (sharing || !post?.id) return;

    setSharing(true);
    try {
      // Verify share authorization via backend & fetch stable share URL
      const res = await postService.getPostShareInfo(post.id);
      const shareUrl = res.shareUrl || `${window.location.origin}/p/${post.id}`;
      const shareTitle = res.title || `Post by @${post.author?.username || "user"}`;
      const shareText = res.text || "Check out this post on Insta-V2";

      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          });
          return;
        } catch (err) {
          // User cancelled native share sheet
          if (err.name === "AbortError") {
            return;
          }
          // Fall through to copy link if navigator.share failed
        }
      }

      // Fallback: Copy Link to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link copied to clipboard");
      } else {
        // Legacy fallback for insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        showToast("Link copied to clipboard");
      }
    } catch (err) {
      showToast(err.message || "Unable to share this post");
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      disabled={sharing}
      title="Share post"
      aria-label="Share post"
    >
      <Send size={size} />
    </button>
  );
}
