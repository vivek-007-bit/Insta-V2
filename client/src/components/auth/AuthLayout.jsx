import React from "react";
import AuthFooter from "./AuthFooter";
import { Heart, MessageCircle, Send, Bookmark } from "lucide-react";

export function InstagramCameraGlyph({ size = 32, className = "" }) {
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

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page-wrapper">
      <main className="auth-main-container">
        {/* Left Side: Instagram-style Dual Device Showcase (Desktop >= 876px) */}
        <div className="auth-visual-showcase" aria-hidden="true">
          <div className="showcase-phone-back">
            <img
              src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&auto=format&fit=crop&q=80"
              alt="Alpine twilight"
            />
          </div>

          <div className="phone-mockup-frame">
            <div className="phone-notch">
              <div className="phone-speaker" />
            </div>
            <div className="phone-screen-content">
              <div className="phone-screen-header">
                <span className="phone-wordmark">Insta-V2</span>
                <Heart size={16} />
              </div>

              <div className="phone-story-strip-mini">
                <div className="phone-story-bubble">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="Story author"
                  />
                </div>
                <div className="phone-story-bubble">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
                    alt="Story author"
                  />
                </div>
                <div className="phone-story-bubble">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                    alt="Story author"
                  />
                </div>
                <div className="phone-story-bubble">
                  <img
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80"
                    alt="Story author"
                  />
                </div>
              </div>

              <div className="phone-post-card-mini">
                <div className="phone-post-header-mini">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
                    alt="Maya Lin"
                  />
                  <span>maya.lin</span>
                </div>
                <img
                  src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80"
                  alt="Kyoto sunset view"
                  className="phone-post-img-mini"
                />
                <div className="phone-post-actions-mini">
                  <div className="phone-post-actions-left">
                    <Heart size={16} fill="var(--accent-red)" stroke="var(--accent-red)" />
                    <MessageCircle size={16} />
                    <Send size={16} />
                  </div>
                  <Bookmark size={16} />
                </div>
                <div className="phone-post-caption-mini">
                  <strong>maya.lin</strong> Golden hour reflections in Kyoto
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Cards */}
        <div className="auth-forms-column">
          {children}
        </div>
      </main>

      <AuthFooter />
    </div>
  );
}
