import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import AuthLayout, { InstagramCameraGlyph } from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import { useApp } from "../context/AppContext";
import { HelpCircle, Loader2, X } from "lucide-react";

export default function Login() {
  const { login, isAuthenticated, authLoading, authError, fetchCurrentUser } = useApp();
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

  const rawFrom = location.state?.from;
  const safeDestination =
    rawFrom?.pathname && rawFrom.pathname !== "/login" && rawFrom.pathname !== "/signup"
      ? `${rawFrom.pathname}${rawFrom.search || ""}${rawFrom.hash || ""}`
      : "/";

  useEffect(() => {
    if (!showForgotModal) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowForgotModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForgotModal]);

  if (authLoading) {
    return (
      <div className="auth-session-loader" role="status" aria-label="Checking session">
        <div className="auth-session-spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={safeDestination} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (formError) setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

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
    setFormError("");

    try {
      const result = await login(formData.identifier, formData.password);
      if (result.success) {
        navigate(safeDestination, { replace: true });
      } else {
        setFormError(result.error || "Sorry, your username or password was incorrect.");
      }
    } catch (err) {
      setFormError(err.message || "An unexpected error occurred during login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(formData.identifier.trim() && formData.password) && !isSubmitting;

  return (
    <AuthLayout>
      {/* Primary Login Card */}
      <div className="auth-card auth-login-card">
        <Link to="/" className="auth-brand-logo" title="Insta-V2">
          <div className="auth-brand-glyph">
            <InstagramCameraGlyph size={28} />
          </div>
          <span className="auth-brand-text">Insta-V2</span>
        </Link>

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
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <span className="auth-btn-loading">
                <Loader2 size={15} className="auth-spin" />
                Logging in...
              </span>
            ) : (
              "Log in"
            )}
          </button>
        </form>

        {(formError || authError) && (
          <div className="auth-error-alert" role="alert">
            <span>{formError || authError}</span>
            {!formError && authError && (
              <button
                type="button"
                className="auth-retry-inline-btn"
                onClick={() => fetchCurrentUser()}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">OR</span>
          <div className="auth-divider-line" />
        </div>

        <button
          type="button"
          className="auth-forgot-link"
          onClick={() => setShowForgotModal(true)}
        >
          Forgot password?
        </button>
      </div>

      {/* Sign up Prompt Card */}
      <div className="auth-switch-card">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </div>

      {/* Help / Account Recovery Dialog */}
      {showForgotModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowForgotModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
        >
          <div
            className="modal-container auth-help-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="auth-help-close"
              onClick={() => setShowForgotModal(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="auth-help-icon">
              <HelpCircle size={28} />
            </div>
            <h3 id="forgot-modal-title" className="auth-help-title">
              Trouble logging in?
            </h3>
            <p className="auth-help-text">
              Sign in using your registered username or email address and password. If you do not have an account yet, you can create one in seconds.
            </p>
            <button
              type="button"
              className="auth-submit-btn"
              onClick={() => {
                setShowForgotModal(false);
                navigate("/signup");
              }}
            >
              Create new account
            </button>
            <button
              type="button"
              className="auth-help-back-btn"
              onClick={() => setShowForgotModal(false)}
            >
              Back to login
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
