import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Camera, Loader2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import mediaService from "../../services/mediaService";
import { optimizeMediaUrl, getAvatarFallbackUrl } from "../../utils/cloudinaryUrl";

export default function EditProfileModal() {
  const { isEditProfileOpen, setIsEditProfileOpen, currentUser, updateProfile } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [avatar, setAvatar] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const previewObjectUrlRef = useRef(null);
  const MAX_BIO_LENGTH = 150;

  const revokePreviewUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    revokePreviewUrl();
    setErrorMessage("");
    setSelectedFile(null);
    setIsEditProfileOpen(false);
  }, [isSubmitting, revokePreviewUrl, setIsEditProfileOpen]);

  useEffect(() => {
    if (currentUser && isEditProfileOpen) {
      revokePreviewUrl();
      setFullName(currentUser.fullName || "");
      setUsername(currentUser.username || "");
      setBio(currentUser.bio || "");
      setWebsite(currentUser.website || "");
      setAvatar(currentUser.avatar || "");
      setSelectedFile(null);
      setErrorMessage("");
      setIsSubmitting(false);
    }
  }, [currentUser, isEditProfileOpen, revokePreviewUrl]);

  useEffect(() => {
    if (!isEditProfileOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isEditProfileOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isEditProfileOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditProfileOpen, handleClose]);

  if (!isEditProfileOpen) return null;

  const handleChangePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select a valid image file.");
        return;
      }
      revokePreviewUrl();
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      previewObjectUrlRef.current = url;
      setAvatar(url);
      setErrorMessage("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) {
      setErrorMessage("Username cannot be empty.");
      return;
    }

    if (trimmedUsername.length < 3 || !/^[a-z0-9_.]+$/.test(trimmedUsername)) {
      setErrorMessage(
        "Username must be at least 3 characters and contain only letters, numbers, periods, and underscores."
      );
      return;
    }

    let normalizedWebsite = website.trim();
    if (normalizedWebsite) {
      if (!/^https?:\/\//i.test(normalizedWebsite)) {
        normalizedWebsite = `https://${normalizedWebsite}`;
      }
      try {
        const parsed = new URL(normalizedWebsite);
        if (!parsed.hostname.includes(".")) {
          setErrorMessage("Please enter a valid website URL.");
          return;
        }
      } catch {
        setErrorMessage("Please enter a valid website URL.");
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      let finalAvatarUrl = avatar;

      if (selectedFile) {
        const sig = await mediaService.getUploadSignature({
          folder: "insta_v2",
          resourceType: "image"
        });
        const uploadRes = await mediaService.uploadToCloudinary(selectedFile, sig);
        finalAvatarUrl = uploadRes.mediaUrl;
      }

      const previousUsername = currentUser?.username;
      const res = await updateProfile({
        fullName: fullName.trim(),
        username: trimmedUsername,
        bio: bio.trim(),
        website: normalizedWebsite,
        avatar: finalAvatarUrl
      });

      if (res && res.success) {
        if (
          previousUsername &&
          res.user?.username &&
          res.user.username !== previousUsername &&
          location.pathname.toLowerCase() === `/profile/${previousUsername.toLowerCase()}`
        ) {
          navigate(`/profile/${encodeURIComponent(res.user.username)}`, { replace: true });
        }
        revokePreviewUrl();
        setSelectedFile(null);
        setIsEditProfileOpen(false);
      } else {
        setErrorMessage(res?.error || "Failed to update profile.");
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to update profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-modal-title"
    >
      <div
        className="modal-container edit-profile-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="edit-profile-header">
          <h2 id="edit-profile-modal-title" className="edit-profile-title">
            Edit profile
          </h2>
          <button
            type="button"
            className="edit-profile-close-btn"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close edit profile"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="edit-profile-form" noValidate>
          <div className="edit-profile-body">
            {/* Profile Photo Card */}
            <div className="edit-profile-photo-card">
              <div className="edit-profile-photo-left">
                <div className="edit-profile-avatar-wrap">
                  <img
                    src={
                      avatar?.startsWith("blob:")
                        ? avatar
                        : optimizeMediaUrl(avatar, { width: 200, isAvatar: true }) ||
                          getAvatarFallbackUrl(username || currentUser?.username)
                    }
                    alt={currentUser?.username || "Avatar"}
                    className="edit-profile-avatar-img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getAvatarFallbackUrl(username || currentUser?.username);
                    }}
                  />
                </div>
                <div className="edit-profile-user-meta">
                  <span className="edit-profile-username-heading">
                    {username || currentUser?.username}
                  </span>
                  <span className="edit-profile-user-fullname">
                    {fullName || currentUser?.fullName}
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="edit-profile-change-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  <Camera size={15} />
                  <span>Change photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleChangePhoto}
                />
              </div>
            </div>

            {errorMessage && (
              <div className="edit-field-error" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="edit-field-group">
              <div className="edit-field-label-row">
                <label htmlFor="edit-profile-name" className="edit-field-label">
                  Name
                </label>
              </div>
              <input
                id="edit-profile-name"
                type="text"
                placeholder="Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="edit-field-input"
                maxLength={60}
              />
              <span className="edit-field-helper">
                Help people discover your account by using the name you're known by.
              </span>
            </div>

            <div className="edit-field-group">
              <div className="edit-field-label-row">
                <label htmlFor="edit-profile-username" className="edit-field-label">
                  Username
                </label>
              </div>
              <input
                id="edit-profile-username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="edit-field-input"
                maxLength={30}
                required
              />
              <span className="edit-field-helper">
                Letters, numbers, periods, and underscores only.
              </span>
            </div>

            <div className="edit-field-group">
              <div className="edit-field-label-row">
                <label htmlFor="edit-profile-website" className="edit-field-label">
                  Website
                </label>
              </div>
              <input
                id="edit-profile-website"
                type="text"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="edit-field-input"
              />
            </div>

            <div className="edit-field-group">
              <div className="edit-field-label-row">
                <label htmlFor="edit-profile-bio" className="edit-field-label">
                  Bio
                </label>
                <span className="edit-field-counter">
                  {bio.length} / {MAX_BIO_LENGTH}
                </span>
              </div>
              <textarea
                id="edit-profile-bio"
                placeholder="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="edit-field-textarea"
                maxLength={MAX_BIO_LENGTH}
                rows={3}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="edit-profile-footer">
            <button
              type="button"
              className="btn-cancel-edit"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save-edit"
              disabled={isSubmitting || !username.trim()}
            >
              {isSubmitting ? (
                <span className="auth-btn-loading">
                  <Loader2 size={15} className="auth-spin" />
                  Saving...
                </span>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
