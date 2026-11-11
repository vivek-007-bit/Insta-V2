import React, { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, Film, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import { useApp } from "../../context/AppContext";
import mediaService from "../../services/mediaService";

export default function CreateStoryModal() {
  const { isCreateStoryOpen, setIsCreateStoryOpen, addNewStory, currentUser } = useApp();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState("image"); // "image" | "video"
  const [caption, setCaption] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
      if (e.key === "Escape" && isCreateStoryOpen && !isUploading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateStoryOpen, previewUrl, isUploading]);

  if (!isCreateStoryOpen) return null;

  const handleClose = () => {
    if (isUploading) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setErrorMessage("");
    setIsUploading(false);
    setUploadProgress(0);
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
    if (isUploading) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setErrorMessage("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select a photo or video for your story.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setUploadProgress(0);

    try {
      // 1. Get signed upload signature from backend
      const signatureData = await mediaService.getUploadSignature({
        folder: "insta_v2/stories",
        resourceType: mediaType === "video" ? "video" : "image"
      });

      // 2. Upload directly to Cloudinary
      const uploadResult = await mediaService.uploadToCloudinary(
        selectedFile,
        signatureData,
        (progress) => setUploadProgress(progress)
      );

      // 3. Save story metadata to MongoDB
      const storyResponse = await mediaService.createStory({
        mediaUrl: uploadResult.mediaUrl,
        publicId: uploadResult.publicId,
        mediaType: uploadResult.mediaType,
        caption
      });

      // 4. Update frontend context with new story
      addNewStory(storyResponse.story);

      // 5. Clean up & close
      handleClose();
    } catch (err) {
      console.error("[CreateStoryModal] Upload error:", err);
      setErrorMessage(err.message || "Failed to upload story. Please try again.");
    } finally {
      setIsUploading(false);
    }
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
        disabled={isUploading}
      >
        <X size={26} />
      </button>

      <div
        className="modal-container create-story-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-story-header">
          {previewUrl && !isUploading ? (
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
              disabled={isUploading}
            >
              {isUploading
                ? uploadProgress > 0
                  ? `Sharing ${uploadProgress}%`
                  : "Sharing..."
                : "Share to Story"}
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
                  src={
                    currentUser?.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                  }
                  alt={currentUser?.username || "user"}
                  className="create-story-author-avatar"
                />
                <span className="create-story-author-name">
                  {currentUser?.username || "user"}
                </span>
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
                  disabled={isUploading}
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
                  disabled={isUploading}
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
                  disabled={isUploading}
                >
                  <Trash2 size={16} />
                  <span>Remove</span>
                </button>
              </div>

              {errorMessage && (
                <div className="create-modal-error-badge" style={{ marginTop: "10px" }}>
                  {errorMessage}
                </div>
              )}

              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  className="create-story-primary-submit"
                  onClick={handleSubmit}
                  disabled={isUploading}
                >
                  {isUploading
                    ? uploadProgress > 0
                      ? `Sharing... (${uploadProgress}%)`
                      : "Sharing..."
                    : "Share to Story"}
                </button>
                <button
                  type="button"
                  className="create-story-cancel-btn"
                  onClick={handleClose}
                  disabled={isUploading}
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
