import React, { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, Film, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function CreateStoryModal() {
  const { isCreateStoryOpen, setIsCreateStoryOpen, addNewStory, currentUser } = useApp();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState("image"); // "image" | "video"
  const [caption, setCaption] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isCreateStoryOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateStoryOpen, previewUrl]);

  if (!isCreateStoryOpen) return null;

  const handleClose = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setErrorMessage("");
    setIsCreateStoryOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setErrorMessage("Please select a supported image or video file.");
      return;
    }

    setErrorMessage("");
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setMediaType(isVideo ? "video" : "image");
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveMedia = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!previewUrl) {
      setErrorMessage("Please select a photo or video for your story.");
      return;
    }

    addNewStory({
      mediaUrl: previewUrl,
      mediaType,
      caption
    });

    handleClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-story-heading"
    >
      <button
        className="modal-close-x"
        onClick={handleClose}
        aria-label="Close story composer"
      >
        <X size={26} />
      </button>

      <div
        className="modal-container create-story-modal"
        onClick={(e) => e.stopPropagation()} // Prevent accidental close on modal interaction
      >
        {/* Header */}
        <div className="create-story-header">
          {previewUrl ? (
            <button
              className="post-action-btn"
              onClick={handleRemoveMedia}
              aria-label="Back to media selection"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 24 }} />
          )}

          <h2 id="create-story-heading" className="create-story-title">
            Create Story
          </h2>

          {previewUrl ? (
            <button
              type="button"
              className="create-story-share-btn"
              onClick={handleSubmit}
            >
              Share to Story
            </button>
          ) : (
            <div style={{ width: 24 }} />
          )}
        </div>

        {/* Modal Body */}
        {!previewUrl ? (
          /* Empty / Upload State */
          <div className="create-story-dropzone">
            <div className="create-story-icon-wrap">
              <ImageIcon size={44} strokeWidth={1.5} className="create-dropzone-icon" />
              <Film size={32} strokeWidth={1.5} className="create-story-video-icon" />
            </div>

            <div className="create-story-prompt">
              <h3 className="create-story-prompt-title">Select photo or video</h3>
              <p className="create-story-prompt-sub">
                Share a moment with your followers. Disappears in 24 hours.
              </p>
            </div>

            {errorMessage && (
              <div className="create-modal-error-badge">{errorMessage}</div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="btn-select-media"
              onClick={() => fileInputRef.current?.click()}
            >
              Select photo or video
            </button>
          </div>
        ) : (
          /* Active Preview State (9:16 Portrait Canvas) */
          <div className="create-story-preview-container">
            <div className="create-story-canvas">
              {/* Top Story Author Pill */}
              <div className="create-story-author-pill">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.username}
                  className="create-story-author-avatar"
                />
                <span className="create-story-author-name">{currentUser.username}</span>
                <span className="create-story-time-badge">Just now</span>
              </div>

              {/* Media Preview Area */}
              <div className="create-story-media-view">
                {mediaType === "video" ? (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    autoPlay
                    className="create-story-media-item"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Story preview"
                    className="create-story-media-item"
                  />
                )}
              </div>

              {/* Story Overlay Controls: Caption */}
              <div className="create-story-bottom-overlay">
                <input
                  type="text"
                  placeholder="Add a caption to your story..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="create-story-caption-input"
                  maxLength={150}
                />
              </div>
            </div>

            {/* Sidebar Tools for Story (Replace, Remove, Post) */}
            <div className="create-story-tools-sidebar">
              <div className="create-story-info-card">
                <span className="create-story-info-title">Your Story</span>
                <span className="create-story-info-desc">Visible to anyone who follows you</span>
              </div>

              <div className="create-story-tool-actions">
                <button
                  type="button"
                  className="create-story-tool-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw size={16} />
                  <span>Replace media</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  className="create-story-tool-btn danger"
                  onClick={handleRemoveMedia}
                >
                  <Trash2 size={16} />
                  <span>Remove</span>
                </button>
              </div>

              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  className="create-story-primary-submit"
                  onClick={handleSubmit}
                >
                  Share to Story
                </button>
                <button
                  type="button"
                  className="create-story-cancel-btn"
                  onClick={handleClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
