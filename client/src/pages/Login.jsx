import React, { useState } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import AuthLayout, { InstagramCameraGlyph } from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import { useApp } from "../context/AppContext";
import { Sparkles, HelpCircle } from "lucide-react";

export default function Login() {
  const { login, quickDemoLogin, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    identifier: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // If already authenticated, redirect to previous location or home
  if (isAuthenticated) {
    const fromPath = location.state?.from?.pathname || "/";
    return <Navigate to={fromPath} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (formError) setFormError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.identifier.trim()) {
      newErrors.identifier = "Phone number, username, or email is required.";
    }
    if (!formData.password) {
      newErrors.password = "Password is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    // Simulate brief network delay
    setTimeout(() => {
      const result = login(formData.identifier, formData.password);
      setIsSubmitting(false);

      if (result.success) {
        const destination = location.state?.from?.pathname || "/";
        navigate(destination, { replace: true });
      } else {
        setFormError(result.error);
      }
    }, 200);
  };

  const handleQuickDemo = (username = "insta_creator") => {
    quickDemoLogin(username);
    const destination = location.state?.from?.pathname || "/";
    navigate(destination, { replace: true });
  };

  return (
    <AuthLayout>
      {/* 1. Main Login Card */}
      <div className="auth-card">
        {/* Brand Header */}
        <Link to="/" className="auth-brand-logo" title="Insta-V2">
          <div className="auth-brand-glyph">
            <InstagramCameraGlyph size={32} />
          </div>
          <span className="auth-brand-text">Insta-V2</span>
        </Link>

        {/* Quick Demo One-Click Access */}
        <button
          type="button"
          className="auth-quick-btn"
          onClick={() => handleQuickDemo("insta_creator")}
          title="One-click Demo Login"
        >
          <Sparkles size={16} />
          <span>Log in as Demo User (@insta_creator)</span>
        </button>

        {/* OR Divider */}
        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">OR</span>
          <div className="auth-divider-line" />
        </div>

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <AuthInput
            id="login-identifier"
            name="identifier"
            type="text"
            placeholder="Phone number, username, or email"
            value={formData.identifier}
            onChange={handleChange}
            error={errors.identifier}
            autoComplete="username"
            required
          />

          <AuthInput
            id="login-password"
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={!formData.identifier.trim() || !formData.password || isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        {/* Inline General Error Alert */}
        {formError && (
          <div className="auth-error-alert" role="alert">
            {formError}
          </div>
        )}

        {/* Forgot Password Link */}
        <button
          type="button"
          className="auth-forgot-link"
          onClick={() => setShowForgotModal(true)}
        >
          Forgot password?
        </button>
      </div>

      {/* 2. Switch to Sign-up Card */}
      <div className="auth-switch-card">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </div>

      {/* Forgot Password Simulated Modal */}
      {showForgotModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowForgotModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container options-modal"
            style={{ padding: "28px 24px", maxWidth: "380px", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  border: "2px solid var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <HelpCircle size={28} />
              </div>
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
              Trouble logging in?
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: "1.5",
                marginBottom: "20px"
              }}
            >
              This is a frontend demo prototype. In a production deployment with Django and MongoDB, you would receive a password reset link at your verified email.
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--accent-blue)",
                fontWeight: "600",
                marginBottom: "20px"
              }}
            >
              Demo credentials: Username: <code>insta_creator</code> (or <code>elena_designs</code>), Password: any 6+ chars.
            </p>
            <button
              type="button"
              className="auth-submit-btn"
              style={{ margin: "0 auto", width: "100%" }}
              onClick={() => {
                handleQuickDemo("insta_creator");
                setShowForgotModal(false);
              }}
            >
              Log in with Demo Account
            </button>
            <button
              type="button"
              className="auth-forgot-link"
              style={{ marginTop: "14px", display: "inline-block" }}
              onClick={() => setShowForgotModal(false)}
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
