import React, { useId } from "react";

export function InstagramCameraGlyph({ size = 26, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
    </svg>
  );
}

export function IgHomeIcon({ active = false, size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      className={className}
      aria-hidden="true"
    >
      {active ? (
        <path d="M22 23h-6.001a1 1 0 0 1-1-1v-5.455a2.997 2.997 0 1 0-5.993 0V22a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V11.543a1.002 1.002 0 0 1 .31-.724l10-9.543a1.001 1.001 0 0 1 1.38 0l10 9.543a1.002 1.002 0 0 1 .31.724V22a1 1 0 0 1-1 1Z" />
      ) : (
        <path
          d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V11.543L12 2 2 11.543V22h7.005Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

export function IgSearchIcon({ active = false, size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {active ? (
        <>
          <path d="M18.5 10.5a8 8 0 1 1-8-8 8 8 0 0 1 8 8Z" strokeWidth="3" />
          <line x1="16.511" y1="16.511" x2="21.643" y2="21.643" strokeWidth="3" />
        </>
      ) : (
        <>
          <path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" strokeWidth="2" />
          <line x1="16.511" y1="16.511" x2="22" y2="22" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

export function IgReelsIcon({ active = false, size = 24, className = "" }) {
  const maskId = useId();

  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <line x1="1.5" y1="7.5" x2="22.5" y2="7.5" stroke="black" strokeWidth="1.8" />
            <line x1="6.8" y1="1.5" x2="9.4" y2="7.5" stroke="black" strokeWidth="1.8" />
            <line x1="13.2" y1="1.5" x2="15.8" y2="7.5" stroke="black" strokeWidth="1.8" />
            <path d="M10.1 11.45a.55.55 0 0 1 .82-.48l5.15 3a.55.55 0 0 1 0 .96l-5.15 3a.55.55 0 0 1-.82-.48v-6Z" fill="black" />
          </mask>
        </defs>
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5.2"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="2.2" y1="7.5" x2="21.8" y2="7.5" stroke="currentColor" strokeWidth="2" />
      <line x1="6.9" y1="2" x2="9.4" y2="7.5" stroke="currentColor" strokeWidth="2" />
      <line x1="13.4" y1="2" x2="15.9" y2="7.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10.1 11.55a.55.55 0 0 1 .82-.48l5 2.95a.55.55 0 0 1 0 .96l-5 2.95a.55.55 0 0 1-.82-.48v-5.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IgMessagesIcon({ active = false, size = 24, className = "" }) {
  const maskId = useId();

  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <line
              x1="21.6"
              y1="3.4"
              x2="9.1"
              y2="10.4"
              stroke="black"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </mask>
        </defs>
        <polygon
          points="11.698 20.8 22.3 3 1.7 3 9.218 10.2 11.698 20.8"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.2"
          mask={`url(#${maskId})`}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <line
        x1="22"
        y1="3"
        x2="9.218"
        y2="10.083"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <polygon
        points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function IgNotificationsIcon({ active = false, size = 24, className = "" }) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" />
    </svg>
  );
}

export function IgCreateIcon({ active = false, size = 24, className = "" }) {
  const maskId = useId();

  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <line x1="6.8" y1="12" x2="17.2" y2="12" stroke="black" strokeWidth="2.1" strokeLinecap="round" />
            <line x1="12" y1="6.8" x2="12" y2="17.2" stroke="black" strokeWidth="2.1" strokeLinecap="round" />
          </mask>
        </defs>
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5.2"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 12v3.45c0 2.849.698 4.005 1.606 4.944.94.909 2.098 1.608 4.946 1.608h6.896c2.848 0 4.006-.7 4.946-1.608C21.302 19.455 22 18.3 22 15.45V8.552c0-2.849-.698-4.006-1.606-4.945C19.454 2.7 18.296 2 15.448 2H8.552c-2.848 0-4.006.699-4.946 1.607C2.698 4.547 2 5.703 2 8.552Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <line x1="6.545" y1="12.001" x2="17.455" y2="12.001" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <line x1="12.003" y1="6.545" x2="12.003" y2="17.455" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function IgMoreIcon({ active = false, size = 24, className = "" }) {
  const strokeWidth = active ? 2.8 : 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    >
      <line x1="3" y1="5" x2="21" y2="5" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="19" x2="21" y2="19" />
    </svg>
  );
}

export function IgSidebarCollapseIcon({ collapsed = false, size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="9" y1="3" x2="9" y2="21" />
      {collapsed ? (
        <polyline points="13.5 9.5 16 12 13.5 14.5" />
      ) : (
        <polyline points="15.5 9.5 13 12 15.5 14.5" />
      )}
    </svg>
  );
}
