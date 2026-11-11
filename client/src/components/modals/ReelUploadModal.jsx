import React, { useState, useRef, useEffect } from "react";
import { X, Film, RefreshCw, Trash2, ArrowLeft, Music } from "lucide-react";
import { useApp } from "../../context/AppContext";
import reelService from "../../services/reelService";

export default function ReelUploadModal({ isOpen, onClose, onReelCreated }) {
  const { currentUser, showToast } = useApp();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [audioTrack, setAudioTrack] = useState("");
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const MAX_VIDEO_SIZE_MB = 100;

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isUploading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUploading]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploading) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setAudioTrack("");
    setDuration(0);
    setAspectRatio("9:16");
    setErrorMessage("");
    setUploadProgress(0);
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setErrorMessage("Please select a valid video file (MP4, WebM, MOV).");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`Video file size must be under ${MAX_VIDEO_SIZE_MB}MB.`);
      return;
    }

    setErrorMessage("");
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveVideo = () => {
    if (isUploading) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setAudioTrack("");
    setDuration(0);
    setErrorMessage("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoMetadata = (e) => {
    const videoEl = e.target;
    if (videoEl.duration && isFinite(videoEl.duration)) {
      setDuration(Math.round(videoEl.duration * 10) / 10);
    }
    if (videoEl.videoWidth && videoEl.videoHeight) {
      const ratio = videoEl.videoWidth / videoEl.videoHeight;
      if (ratio < 0.7) setAspectRatio("9:16");
      else if (ratio > 1.2) setAspectRatio("16:9");
      else setAspectRatio("1:1");
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select a video for your Reel.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setUploadProgress(0);

    try {
      // 1. Request signed upload signature from Node.js backend
      const signatureData = await reelService.getUploadSignature();

      // 2. Upload video directly to Cloudinary
      const uploadRes = await reelService.uploadVideoToCloudinary(
        selectedFile,
        signatureData,
        (pct) => setUploadProgress(pct)
      );

      // 3. Save Reel metadata to MongoDB
      const createRes = await reelService.createReel({
        videoUrl: uploadRes.videoUrl,
        publicId: uploadRes.publicId,
        caption: caption.trim(),
        audioTrack: audioTrack.trim(),
        duration: duration || uploadRes.duration || 0,
        aspectRatio
      });

      showToast("Reel published!");
      onReelCreated?.(createRes.reel);
      handleClose();
    } catch (err) {
      console.error("[ReelUploadModal] Upload error:", err);
      setErrorMessage(err.message || "Failed to upload Reel. Please try again.");
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
      aria-labelledby="create-reel-heading"
    >
      <button
        className="modal-close-x"
        onClick={handleClose}
        aria-label="Close modal"
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
              type="button"
              className="post-action-btn"
              onClick={handleRemoveVideo}
              aria-label="Back to video selection"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 24 }} />
          )}

          <h2 id="create-reel-heading" className="create-story-title">
            New Reel
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
                : "Share"}
            </button>
          ) : (
            <div style={{ width: 24 }} />
          )}
        </div>

        {/* Body */}
        {!previewUrl ? (
          <div className="create-story-dropzone">
            <div className="create-story-icon-wrap">
              <Film size={44} strokeWidth={1.5} className="create-dropzone-icon" />
            </div>

            <div className="create-story-prompt">
              <h3 className="create-story-prompt-title">Select video to upload</h3>
              <p className="create-story-prompt-sub">
                Share short vertical videos (MP4, WebM, MOV up to {MAX_VIDEO_SIZE_MB}MB).
              </p>
            </div>

            {errorMessage && (
              <div className="create-modal-error-badge">{errorMessage}</div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/webm,video/quicktime,video/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="btn-select-media"
              onClick={() => fileInputRef.current?.click()}
            >
              Select video from computer
            </button>
          </div>
        ) : (
          <div className="create-story-preview-container">
            <div className="create-story-canvas">
              <div className="create-story-author-pill">
                <img
                  src={currentUser?.avatar}
                  alt={currentUser?.username}
                  className="create-story-author-avatar"
                />
                <span className="create-story-author-name">
                  {currentUser?.username}
                </span>
                {duration > 0 && (
                  <span className="create-story-time-badge">{duration}s</span>
                )}
              </div>

              <div className="create-story-media-view">
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  autoPlay
                  muted
                  loop
                  onLoadedMetadata={handleVideoMetadata}
                  className="create-story-media-item"
                />
              </div>
            </div>

            {/* Sidebar Details & Controls */}
            <div className="create-story-tools-sidebar">
              <div className="create-story-info-card">
                <span className="create-story-info-title">Reel Details</span>
                <span className="create-story-info-desc">
                  Visible according to your account privacy ({currentUser?.isPrivate ? "Private" : "Public"})
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                <textarea
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                  rows={4}
                  disabled={isUploading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-secondary)",
                    fontSize: "var(--font-size-sm)",
                    resize: "none"
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-secondary)"
                  }}
                >
                  <Music size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Audio track (optional)"
                    value={audioTrack}
                    onChange={(e) => setAudioTrack(e.target.value)}
                    maxLength={120}
                    disabled={isUploading}
                    style={{
                      border: "none",
                      outline: "none",
                      width: "100%",
                      fontSize: "var(--font-size-xs)",
                      background: "transparent"
                    }}
                  />
                </div>
              </div>

              <div className="create-story-tool-actions" style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="create-story-tool-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <RefreshCw size={16} />
                  <span>Replace video</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  className="create-story-tool-btn danger"
                  onClick={handleRemoveVideo}
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
                      ? `Uploading... (${uploadProgress}%)`
                      : "Uploading..."
                    : "Share Reel"}
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
