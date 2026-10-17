import React, { useState, useRef } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Music,
  CheckCircle2
} from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Reels() {
  const { initialReels, setSelectedPostDetail, setShareDialogPost, showToast } = useApp();
  const [reels, setReels] = useState(initialReels);
  const [isMuted, setIsMuted] = useState(true);
  const [playingId, setPlayingId] = useState(initialReels[0]?.id || null);

  const videoRefs = useRef({});

  const togglePlay = (id) => {
    const video = videoRefs.current[id];
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setPlayingId(id);
    } else {
      video.pause();
      setPlayingId(null);
    }
  };

  const toggleLikeReel = (id) => {
    setReels(prev =>
      prev.map(r => {
        if (r.id === id) {
          const willLike = !r.isLiked;
          return {
            ...r,
            isLiked: willLike,
            likesCount: willLike ? r.likesCount + 1 : r.likesCount - 1
          };
        }
        return r;
      })
    );
  };

  const toggleSaveReel = (id) => {
    setReels(prev =>
      prev.map(r => {
        if (r.id === id) {
          const willSave = !r.isSaved;
          showToast(willSave ? "Saved reel to collection" : "Removed from collection");
          return { ...r, isSaved: willSave };
        }
        return r;
      })
    );
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {reels.map(reel => {
          const isPlaying = playingId === reel.id;

          return (
            <div
              key={reel.id}
              style={{
                display: "flex",
                gap: "16px",
                alignItems: "flex-end"
              }}
            >
              {/* Video Player Card */}
              <div
                style={{
                  position: "relative",
                  width: "360px",
                  height: "640px",
                  maxHeight: "82vh",
                  backgroundColor: "#000000",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
                }}
              >
                <video
                  ref={el => (videoRefs.current[reel.id] = el)}
                  src={reel.videoUrl}
                  poster={reel.posterUrl}
                  loop
                  muted={isMuted}
                  playsInline
                  autoPlay
                  onClick={() => togglePlay(reel.id)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    cursor: "pointer"
                  }}
                  onError={(e) => {
                    // Graceful fallback if video fails to load
                    e.target.style.display = "none";
                  }}
                />

                {/* Play icon overlay if paused */}
                {!isPlaying && (
                  <div
                    onClick={() => togglePlay(reel.id)}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      cursor: "pointer",
                      pointerEvents: "none"
                    }}
                  >
                    <Play size={28} fill="#ffffff" style={{ marginLeft: "4px" }} />
                  </div>
                )}

                {/* Mute button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                  aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* Reel Bottom Meta */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "14px",
                    right: "14px",
                    color: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                      src={reel.author.avatar}
                      alt={reel.author.username}
                      style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #fff" }}
                    />
                    <span style={{ fontWeight: "600", fontSize: "var(--font-size-sm)" }}>
                      {reel.author.username}
                    </span>
                    {reel.author.isVerified && (
                      <CheckCircle2 size={14} fill="currentColor" color="var(--accent-blue)" />
                    )}
                    <button
                      onClick={() => showToast(`Followed ${reel.author.username}`)}
                      style={{
                        color: "#ffffff",
                        border: "1px solid rgba(255, 255, 255, 0.7)",
                        padding: "3px 10px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: "600"
                      }}
                    >
                      Follow
                    </button>
                  </div>

                  <p style={{ fontSize: "var(--font-size-sm)", lineHeight: "1.3" }}>
                    {reel.caption}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", opacity: 0.9 }}>
                    <Music size={12} />
                    <span>{reel.audioTrack}</span>
                  </div>
                </div>
              </div>

              {/* Reel Vertical Action Buttons */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "18px",
                  paddingBottom: "8px"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <button
                    onClick={() => toggleLikeReel(reel.id)}
                    style={{
                      padding: "8px",
                      color: reel.isLiked ? "var(--accent-red)" : "var(--text-primary)"
                    }}
                    aria-label="Like reel"
                  >
                    <Heart
                      size={24}
                      fill={reel.isLiked ? "var(--accent-red)" : "none"}
                      stroke={reel.isLiked ? "var(--accent-red)" : "currentColor"}
                    />
                  </button>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                    {reel.likesCount.toLocaleString()}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <button
                    onClick={() => showToast(`Comments for ${reel.author.username}'s reel`)}
                    style={{ padding: "8px", color: "var(--text-primary)" }}
                    aria-label="Comments"
                  >
                    <MessageCircle size={24} />
                  </button>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                    {reel.commentsCount}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <button
                    onClick={() => setShareDialogPost({ id: reel.id })}
                    style={{ padding: "8px", color: "var(--text-primary)" }}
                    aria-label="Share reel"
                  >
                    <Send size={24} />
                  </button>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                    {reel.sharesCount}
                  </span>
                </div>

                <button
                  onClick={() => toggleSaveReel(reel.id)}
                  style={{ padding: "8px", color: "var(--text-primary)" }}
                  aria-label="Save reel"
                >
                  <Bookmark
                    size={24}
                    fill={reel.isSaved ? "currentColor" : "none"}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
