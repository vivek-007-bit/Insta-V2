import React, { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, MapPin, ArrowLeft, RefreshCw, Trash2, Smile } from "lucide-react";
import { useApp } from "../../context/AppContext";
import mediaService from "../../services/mediaService";

export default function CreatePostModal() {
  const { isCreateModalOpen, setIsCreateModalOpen, addNewPost, currentUser } = useApp();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [mediaAspect, setMediaAspect] = useState("square");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
      if (e.key === "Escape" && isCreateModalOpen && !isUploading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen, previewUrl, isUploading]);

  if (!isCreateModalOpen) return null;

  const handleClose = () => {
    if (isUploading) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
    setLocation("");
    setErrorMessage("");
    setIsUploading(false);
    setUploadProgress(0);
    setIsCreateModalOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setErrorMessage("Please select a valid image or video file.");
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
    if (isUploading) return;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please choose a photo or video to share.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setUploadProgress(0);

    try {
      // 1. Request upload signature from server
      const isVideo = selectedFile.type.startsWith("video/");
      const signatureData = await mediaService.getUploadSignature({
        folder: "insta_v2/posts",
        resourceType: isVideo ? "video" : "image"
      });

      // 2. Upload directly to Cloudinary using signed parameters
      const uploadResult = await mediaService.uploadToCloudinary(
        selectedFile,
        signatureData,
        (progress) => setUploadProgress(progress)
      );

      // 3. Save post metadata to backend database
      const postResponse = await mediaService.createPost({
        mediaUrl: uploadResult.mediaUrl,
        publicId: uploadResult.publicId,
        mediaType: uploadResult.mediaType,
        caption,
        location,
        mediaAspect
      });

      // 4. Update frontend context with created post
      addNewPost(postResponse.post);

      // 5. Clean up & close
      handleClose();
    } catch (err) {
      console.error("[CreatePostModal] Upload error:", err);
      setErrorMessage(err.message || "Failed to upload and create post. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const isVideo = selectedFile?.type?.startsWith("video/");

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
        disabled={isUploading}
      >
        <X size={26} />
      </button>

      <div
        className="modal-container create-post-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-post-header">
          {previewUrl && !isUploading ? (
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

        {/* Modal Body */}
        {!previewUrl ? (
          /* Redesigned Empty State */
          <div className="create-post-dropzone">
            <div className="create-dropzone-icon-box">
              <ImageIcon size={52} strokeWidth={1.4} className="create-dropzone-icon" />
            </div>

            <div className="create-dropzone-text-group">
              <h3 className="create-dropzone-title">Drag photos or videos here</h3>
              <p className="create-dropzone-sub">
                Upload high resolution photos and videos for your profile and feed
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
              className="btn-select-computer"
              onClick={() => fileInputRef.current?.click()}
            >
              Select from computer
            </button>
          </div>
        ) : (
          /* Two-Panel Post Composer */
          <div className="create-post-editor">
            {/* Left Panel: Media Preview */}
            <div className="create-preview-area">
              <div className={`create-preview-canvas create-aspect-${mediaAspect}`}>
                {isVideo ? (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="create-preview-img"
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Upload preview"
                    className="create-preview-img"
                  />
                )}
              </div>

              {/* Bottom Media Controls (Ratio switcher & replace) */}
              <div className="create-preview-control-bar">
                <div className="create-ratio-selector">
                  <button
                    type="button"
                    className={`create-ratio-btn ${mediaAspect === "square" ? "active" : ""}`}
                    onClick={() => setMediaAspect("square")}
                    title="1:1 Square"
                    disabled={isUploading}
                  >
                    1:1
                  </button>
                  <button
                    type="button"
                    className={`create-ratio-btn ${mediaAspect === "portrait" ? "active" : ""}`}
                    onClick={() => setMediaAspect("portrait")}
                    title="4:5 Portrait"
                    disabled={isUploading}
                  >
                    4:5
                  </button>
                  <button
                    type="button"
                    className={`create-ratio-btn ${mediaAspect === "landscape" ? "active" : ""}`}
                    onClick={() => setMediaAspect("landscape")}
                    title="16:9 Landscape"
                    disabled={isUploading}
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
                    disabled={isUploading}
                  >
                    <RefreshCw size={13} />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    className="create-media-action-pill danger"
                    onClick={handleRemoveImage}
                    title="Remove image"
                    disabled={isUploading}
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
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {/* Right Panel: Post Details */}
            <div className="create-form-area">
              {/* User row */}
              <div className="create-author-row">
                <img
                  src={
                    currentUser?.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                  }
                  alt={currentUser?.username || "user"}
                  className="create-author-avatar"
                />
                <span className="create-author-username">
                  {currentUser?.username || "user"}
                </span>
              </div>

              {/* Caption field */}
              <div className="create-caption-container">
                <textarea
                  className="create-caption-textarea"
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={MAX_CAPTION_LENGTH}
                  disabled={isUploading}
                />
                <div className="create-caption-footer">
                  <button
                    type="button"
                    className="create-emoji-btn"
                    title="Add emoji"
                    onClick={() => setCaption((prev) => prev + " ✨")}
                    disabled={isUploading}
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
                  disabled={isUploading}
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
                  disabled={isUploading}
                >
                  {isUploading
                    ? uploadProgress > 0
                      ? `Sharing... (${uploadProgress}%)`
                      : "Sharing..."
                    : "Share Post"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
