import React, { useState, useEffect, useRef } from "react";
import { X, Camera } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function EditProfileModal() {
  const { isEditProfileOpen, setIsEditProfileOpen, currentUser, updateProfile } = useApp();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [avatar, setAvatar] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const MAX_BIO_LENGTH = 150;

  // Initialize form with current profile data when opened
  useEffect(() => {
    if (currentUser && isEditProfileOpen) {
      setFullName(currentUser.fullName || "");
      setUsername(currentUser.username || "");
      setBio(currentUser.bio || "");
      setWebsite(currentUser.website || "");
      setAvatar(currentUser.avatar || "");
      setErrorMessage("");
      setIsSubmitting(false);
    }
  }, [currentUser, isEditProfileOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isEditProfileOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditProfileOpen, setIsEditProfileOpen]);

  if (!isEditProfileOpen) return null;

  const handleClose = () => {
    setErrorMessage("");
    setIsEditProfileOpen(false);
  };

  const handleChangePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select a valid image file.");
        return;
      }
      const url = URL.createObjectURL(file);
      setAvatar(url);
      setErrorMessage("");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage("Username cannot be empty.");
      return;
    }

    if (trimmedUsername.includes(" ")) {
      setErrorMessage("Username cannot contain spaces.");
      return;
    }

    setIsSubmitting(true);

    updateProfile({
      fullName: fullName.trim(),
      username: trimmedUsername,
      bio: bio.trim(),
      website: website.trim(),
      avatar
    });

    handleClose();
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
        onClick={(e) => e.stopPropagation()} // Prevent accidental close on modal click
      >
        {/* Header */}
        <div className="edit-profile-header">
          <h2 id="edit-profile-modal-title" className="edit-profile-title">
            Edit Profile
          </h2>
          <button
            type="button"
            className="edit-profile-close-btn"
            onClick={handleClose}
            aria-label="Close edit profile"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="edit-profile-body">
            {/* Profile Photo Card */}
            <div className="edit-profile-photo-card">
              <div className="edit-profile-photo-left">
                <div className="edit-profile-avatar-wrap">
                  <img
                    src={avatar}
                    alt={currentUser?.username || "Avatar"}
                    className="edit-profile-avatar-img"
                  />
                </div>
                <div className="edit-profile-user-meta">
                  <span className="edit-profile-username-heading">{username || currentUser?.username}</span>
                  <span className="edit-profile-user-fullname">{fullName || currentUser?.fullName}</span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="edit-profile-change-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload new profile picture"
                >
                  <Camera size={16} />
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

            {/* Error Message if any */}
            {errorMessage && (
              <div className="edit-field-error" role="alert">
                {errorMessage}
              </div>
            )}

            {/* 1. Name Field */}
            <div className="edit-field-group">
              <div className="edit-field-label-row">
                <label htmlFor="edit-profile-name" className="edit-field-label">
                  Name
                </label>
              </div>
              <input
                id="edit-profile-name"
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="edit-field-input"
                maxLength={60}
              />
              <span className="edit-field-helper">
                Help people discover your account by using the name you're known by.
              </span>
            </div>

            {/* 2. Username Field */}
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
                In most cases, you'll be able to change your username back to {currentUser?.username}.
              </span>
            </div>

            {/* 3. Website Field */}
            <div className="edit-field-group">
              <div className="edit-field-label-row">
                <label htmlFor="edit-profile-website" className="edit-field-label">
                  Website
                </label>
              </div>
              <input
                id="edit-profile-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="edit-field-input"
              />
            </div>

            {/* 4. Bio Field */}
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
                placeholder="Tell your story or describe what you share..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="edit-field-textarea"
                maxLength={MAX_BIO_LENGTH}
                rows={4}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="edit-profile-footer">
            <button
              type="button"
              className="btn-cancel-edit"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save-edit"
              disabled={isSubmitting || !username.trim()}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
