import React, { useState, useEffect } from "react";
import { ImageOff, Film } from "lucide-react";
import { optimizeMediaUrl, isVideoMedia } from "../../utils/cloudinaryUrl";

export default function MediaRenderer({
  src,
  mediaType = "image",
  alt = "Post media",
  variant = "feed", // "feed" | "modal" | "grid"
  className = "",
  style = {},
  onVideoMetadata
}) {
  const widthMap = {
    feed: 1080,
    modal: 1200,
    grid: 500
  };

  const resolvedUrl = optimizeMediaUrl(src, { width: widthMap[variant] || 1080 });
  const isVideo = isVideoMedia(resolvedUrl, mediaType);

  const [isLoading, setIsLoading] = useState(Boolean(resolvedUrl));
  const [hasError, setHasError] = useState(!resolvedUrl);

  // Reset state whenever source changes (e.g., switching posts in modal)
  useEffect(() => {
    setIsLoading(Boolean(resolvedUrl));
    setHasError(!resolvedUrl);
  }, [resolvedUrl]);

  const objectFit = variant === "modal" ? "contain" : "cover";

  if (!resolvedUrl || hasError) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          minHeight: variant === "grid" ? "100%" : "260px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          backgroundColor: variant === "modal" ? "#111111" : "var(--bg-secondary)",
          color: "var(--text-secondary)",
          padding: "16px",
          textAlign: "center",
          ...style
        }}
      >
        {isVideo ? <Film size={28} strokeWidth={1.5} /> : <ImageOff size={28} strokeWidth={1.5} />}
        {variant !== "grid" && (
          <span style={{ fontSize: "var(--font-size-xs)" }}>Media unavailable</span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      {/* Subtle loading placeholder */}
      {isLoading && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: variant === "modal" ? "#0a0a0a" : "var(--bg-secondary)",
            zIndex: 1
          }}
        />
      )}

      {isVideo ? (
        <video
          key={resolvedUrl}
          src={resolvedUrl}
          controls={variant !== "grid"}
          muted={variant === "grid"}
          playsInline
          preload="metadata"
          className={className}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            display: "block",
            opacity: isLoading ? 0 : 1,
            transition: "opacity 0.2s ease",
            ...style
          }}
          onLoadedMetadata={(e) => {
            setIsLoading(false);
            onVideoMetadata?.({
              width: e.target.videoWidth,
              height: e.target.videoHeight
            });
          }}
          onLoadedData={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      ) : (
        <img
          key={resolvedUrl}
          src={resolvedUrl}
          alt={alt}
          className={className}
          loading={variant === "modal" ? "eager" : "lazy"}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            display: "block",
            opacity: isLoading ? 0 : 1,
            transition: "opacity 0.2s ease",
            ...style
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      )}
    </div>
  );
}
