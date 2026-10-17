import React, { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, MapPin, ArrowLeft, RefreshCw, Trash2, Smile } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function CreatePostModal() {
  const { isCreateModalOpen, setIsCreateModalOpen, addNewPost, currentUser } = useApp();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [mediaAspect, setMediaAspect] = useState("square");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

  const MAX_CAPTION_LENGTH = 2200;

  // Clean up object URL when component unmounts or preview changes
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
      if (e.key === "Escape" && isCreateModalOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen, previewUrl]);

  if (!isCreateModalOpen) return null;

  const handleClose = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setLocation("");
    setErrorMessage("");
    setIsCreateModalOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPG, PNG, WebP).");
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

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!previewUrl) {
      setErrorMessage("Please choose a photo to share.");
      return;
    }

    addNewPost({
      mediaUrl: previewUrl,
      caption,
      location,
      mediaAspect
    });

    handleClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-heading"
    >
      <button
        className="modal-close-x"
        onClick={handleClose}
        aria-label="Close modal"
      >
        <X size={26} />
      </button>

      <div
        className="modal-container create-post-modal"
        onClick={(e) => e.stopPropagation()} // Prevent accidental close on modal click
      >
        {/* Header */}
        <div className="create-post-header">
          {previewUrl ? (
            <button
              type="button"
              className="post-action-btn"
              onClick={handleRemoveImage}
              aria-label="Back to select computer"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 24 }} />
          )}

          <h2 id="create-post-heading" className="create-post-title">
            Create new post
          </h2>

          {previewUrl ? (
            <button
              type="button"
              className="create-post-share-btn"
              onClick={handleSubmit}
            >
              Share
            </button>
          ) : (
            <div style={{ width: 24 }} />
          )}
        </div>

        {/* Modal Body */}
        {!previewUrl ? (
          /* Redesigned Empty State */
          <div className="create-post-dropzone">
            <div className="create-dropzone-icon-box">
              <ImageIcon size={52} strokeWidth={1.4} className="create-dropzone-icon" />
            </div>

            <div className="create-dropzone-text-group">
              <h3 className="create-dropzone-title">Drag photos here</h3>
              <p className="create-dropzone-sub">
                Upload high resolution photos for your profile and feed
              </p>
            </div>

            {errorMessage && (
              <div className="create-modal-error-badge">{errorMessage}</div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="btn-select-computer"
              onClick={() => fileInputRef.current?.click()}
            >
              Select from computer
            </button>
          </div>
        ) : (
          /* Redesigned Two-Panel Post Composer */
          <div className="create-post-editor">
            {/* Left Panel: Media Preview */}
            <div className="create-preview-area">
              <div className={`create-preview-canvas create-aspect-${mediaAspect}`}>
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="create-preview-img"
                />
              </div>

              {/* Bottom Media Controls (Ratio switcher & replace) */}
              <div className="create-preview-control-bar">
                <div className="create-ratio-selector">
                  <button
                    type="button"
                    className={`create-ratio-btn ${mediaAspect === "square" ? "active" : ""}`}
                    onClick={() => setMediaAspect("square")}
                    title="1:1 Square"
                  >
                    1:1
                  </button>
                  <button
                    type="button"
                    className={`create-ratio-btn ${mediaAspect === "portrait" ? "active" : ""}`}
                    onClick={() => setMediaAspect("portrait")}
                    title="4:5 Portrait"
                  >
                    4:5
                  </button>
                  <button
                    type="button"
                    className={`create-ratio-btn ${mediaAspect === "landscape" ? "active" : ""}`}
                    onClick={() => setMediaAspect("landscape")}
                    title="16:9 Landscape"
                  >
                    16:9
                  </button>
                </div>

                <div className="create-media-actions-group">
                  <button
                    type="button"
                    className="create-media-action-pill"
                    onClick={() => fileInputRef.current?.click()}
                    title="Replace image"
                  >
                    <RefreshCw size={13} />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    className="create-media-action-pill danger"
                    onClick={handleRemoveImage}
                    title="Remove image"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hidden Input for Replace */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {/* Right Panel: Post Details */}
            <div className="create-form-area">
              {/* User row */}
              <div className="create-author-row">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.username}
                  className="create-author-avatar"
                />
                <span className="create-author-username">{currentUser.username}</span>
              </div>

              {/* Caption field */}
              <div className="create-caption-container">
                <textarea
                  className="create-caption-textarea"
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={MAX_CAPTION_LENGTH}
                />
                <div className="create-caption-footer">
                  <button
                    type="button"
                    className="create-emoji-btn"
                    title="Add emoji"
                    onClick={() => setCaption(prev => prev + " ✨")}
                  >
                    <Smile size={18} />
                  </button>
                  <span className="create-character-counter">
                    {caption.length}/{MAX_CAPTION_LENGTH}
                  </span>
                </div>
              </div>

              {/* Location Input */}
              <div className="create-location-box">
                <input
                  type="text"
                  placeholder="Add location"
                  className="create-location-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <MapPin size={16} className="create-location-icon" />
              </div>

              {/* Error badge if any */}
              {errorMessage && (
                <div className="create-modal-error-badge">{errorMessage}</div>
              )}

              {/* Mobile-friendly bottom action button */}
              <div className="create-form-submit-row">
                <button
                  type="button"
                  className="create-submit-btn-full"
                  onClick={handleSubmit}
                >
                  Share Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
