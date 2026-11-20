import React, { useRef } from "react";
import { Server, Monitor, Cpu } from "lucide-react";
import "../styles/landing.css";

const BACKEND_HEALTH_URL = "https://instav2-server.onrender.com/api/health";
const ML_HEALTH_URL = "https://instav2-recommender.onrender.com/api/ml/health";

export default function LandingPage() {
  const gettingStartedRef = useRef(null);

  const getFrontendUrl = () => {
    if (import.meta.env.VITE_CLIENT_URL) {
      return import.meta.env.VITE_CLIENT_URL;
    }
    return "https://insta-v2.netlify.app";
  };

  const handleGetStartedClick = () => {
    if (gettingStartedRef.current) {
      gettingStartedRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="lp-container">
      {/* ==================================================================
          SECTION 1 — HERO
          ================================================================== */}
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true" />
        <div className="lp-hero-overlay" aria-hidden="true" />

        <div className="lp-hero-content">
          <h1 className="lp-hero-title">Welcome to Insta-V2</h1>
          <p className="lp-hero-subtitle">
            Your social experience, powered by intelligent recommendations.
          </p>
          <button
            type="button"
            className="lp-hero-btn"
            onClick={handleGetStartedClick}
          >
            GET STARTED
          </button>
        </div>
      </section>

      {/* ==================================================================
          SECTION 2 — GETTING STARTED
          ================================================================== */}
      <section
        className="lp-getting-started"
        id="getting-started"
        ref={gettingStartedRef}
      >
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-title">Get Started with Insta-V2</h2>
            <p className="lp-section-subtitle">
              Follow these simple steps before accessing the application.
            </p>
          </div>

          {/* Three Horizontally Aligned Cards */}
          <div className="lp-cards-grid">
            {/* Card 1: Activate Backend */}
            <div className="lp-card">
              <div className="lp-card-icon-wrap">
                <Server size={28} strokeWidth={2.2} />
              </div>
              <h3 className="lp-card-title">Activate Backend</h3>
              <p className="lp-card-desc">
                Wake up the Insta-V2 backend before opening the application.
                Render may put inactive services to sleep, so the first request
                can take some time.
              </p>
              <a
                href={BACKEND_HEALTH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-card-btn"
              >
                ACTIVATE BACKEND
              </a>
            </div>

            {/* Card 2: Access Frontend */}
            <div className="lp-card">
              <div className="lp-card-icon-wrap">
                <Monitor size={28} strokeWidth={2.2} />
              </div>
              <h3 className="lp-card-title">Access Frontend</h3>
              <p className="lp-card-desc">
                Once the backend is active, open Insta-V2 and log in to explore
                posts, Reels, Stories, messaging, and personalized recommendations.
              </p>
              <a
                href={getFrontendUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-card-btn"
              >
                OPEN INSTAV2
              </a>
            </div>

            {/* Card 3: Activate ML Engine (Optional) */}
            <div className="lp-card">
              <div className="lp-card-icon-wrap">
                <Cpu size={28} strokeWidth={2.2} />
              </div>
              <h3 className="lp-card-title">Activate ML Engine (Optional)</h3>
              <p className="lp-card-desc">
                The ML engine powers personalized user, post, and Reel
                recommendations. Activate it if you want to use the
                recommendation service. This step is optional.
              </p>
              <a
                href={ML_HEALTH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-card-btn"
              >
                ACTIVATE ML ENGINE
              </a>
            </div>
          </div>

          {/* Important Render Cold-Start Explanation */}
          <div className="lp-coldstart-box">
            <h4 className="lp-coldstart-title">
              Why do I need to activate the services?
            </h4>
            <p className="lp-coldstart-text">
              Insta-V2 is deployed using Render&apos;s free hosting services.
              Inactive services may automatically spin down. Because of this, the
              first request can take some time while Render performs a cold
              start. Activate the backend first and wait for it to respond before
              opening the frontend. The ML engine can be activated separately
              when recommendation features are needed.
            </p>
            <div className="lp-sequence-box">
              <span className="lp-sequence-item">1. Activate Backend</span>
              <span className="lp-sequence-arrow">→</span>
              <span className="lp-sequence-item">2. Open Frontend</span>
              <span className="lp-sequence-arrow">→</span>
              <span className="lp-sequence-item optional">
                3. Activate ML Engine (Optional)
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
