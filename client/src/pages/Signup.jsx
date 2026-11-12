import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import AuthLayout, { InstagramCameraGlyph } from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import { useApp } from "../context/AppContext";
import authService from "../services/authService";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function Signup() {
  const { signup, isAuthenticated, authLoading } = useApp();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    username: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live debounced username availability status
  const [usernameStatus, setUsernameStatus] = useState(null); // null | "checking" | "available" | "unavailable"
  const [usernameFeedback, setUsernameFeedback] = useState("");
  const usernameAbortRef = useRef(null);

  useEffect(() => {
    const clean = formData.username.trim().toLowerCase();
    if (!clean || clean.length < 3 || !/^[a-z0-9_.]+$/.test(clean)) {
      if (usernameAbortRef.current) {
        usernameAbortRef.current.abort();
        usernameAbortRef.current = null;
      }
      return undefined;
    }

    const timer = setTimeout(async () => {
      if (usernameAbortRef.current) {
        usernameAbortRef.current.abort();
      }
      const controller = new AbortController();
      usernameAbortRef.current = controller;
      setUsernameStatus("checking");

      try {
        const res = await authService.checkUsername(clean, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res?.available) {
          setUsernameStatus("available");
          setUsernameFeedback("");
        } else {
          setUsernameStatus("unavailable");
          setUsernameFeedback(res?.message || "This username is already taken.");
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setUsernameStatus(null);
        setUsernameFeedback("");
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.username]);

  if (authLoading) {
    return (
      <div className="auth-session-loader" role="status" aria-label="Checking session">
        <div className="auth-session-spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const validateField = (name, value) => {
    switch (name) {
      case "email":
        if (!value.trim()) return "Email address is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return "Please enter a valid email address.";
        }
        return "";
      case "fullName":
        if (!value.trim()) return "Full name is required.";
        return "";
      case "username":
        if (!value.trim()) return "Username is required.";
        if (value.trim().length < 3) return "Username must be at least 3 characters.";
        if (!/^[a-zA-Z0-9_.]+$/.test(value.trim())) {
          return "Only letters, numbers, periods, and underscores allowed.";
        }
        return "";
      case "password":
        if (!value) return "Password is required.";
        if (value.length < 6) return "Password must be at least 6 characters.";
        return "";
      default:
        return "";
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "username") {
      const clean = value.trim().toLowerCase();
      if (!clean || clean.length < 3 || !/^[a-z0-9_.]+$/.test(clean)) {
        setUsernameStatus(null);
        setUsernameFeedback("");
      } else {
        setUsernameStatus("checking");
      }
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (formError) setFormError("");
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const errorMsg = validateField(name, value);
    if (errorMsg) {
      setErrors((prev) => ({ ...prev, [name]: errorMsg }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (usernameStatus === "unavailable" && !newErrors.username) {
      newErrors.username = usernameFeedback || "This username isn't available.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setSuccessMessage("");

    try {
      const result = await signup({
        fullName: formData.fullName.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });

      if (result.success) {
        setSuccessMessage("Account created! Welcome to Insta-V2.");
        navigate("/", { replace: true });
      } else {
        setFormError(result.error || "Failed to create account.");
      }
    } catch (err) {
      setFormError(err.message || "An error occurred during registration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormComplete =
    formData.email.trim() &&
    formData.fullName.trim() &&
    formData.username.trim().length >= 3 &&
    formData.password.length >= 6 &&
    usernameStatus !== "unavailable";

  return (
    <AuthLayout>
      {/* Main Sign-up Card */}
      <div className="auth-card auth-signup-card">
        <Link to="/" className="auth-brand-logo" title="Insta-V2">
          <div className="auth-brand-glyph">
            <InstagramCameraGlyph size={28} />
          </div>
          <span className="auth-brand-text">Insta-V2</span>
        </Link>

        <h2 className="auth-subtitle">
          Sign up to see photos and videos from your friends.
        </h2>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <AuthInput
            id="signup-email"
            name="email"
            type="email"
            placeholder="Email address"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.email}
            autoComplete="email"
            required
          />

          <AuthInput
            id="signup-fullname"
            name="fullName"
            type="text"
            placeholder="Full Name"
            value={formData.fullName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.fullName}
            autoComplete="name"
            required
          />

          <AuthInput
            id="signup-username"
            name="username"
            type="text"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.username || (usernameStatus === "unavailable" ? usernameFeedback : "")}
            status={usernameStatus}
            autoComplete="username"
            required
          />

          <AuthInput
            id="signup-password"
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.password}
            autoComplete="new-password"
            required
          />

          <p className="auth-terms-text">
            People who use our service may have uploaded your contact information to Insta-V2.{" "}
            <a href="#learn-more" onClick={(e) => e.preventDefault()}>
              Learn More
            </a>
          </p>

          <p className="auth-terms-text">
            By signing up, you agree to our{" "}
            <a href="#terms" onClick={(e) => e.preventDefault()}>
              Terms
            </a>
            ,{" "}
            <a href="#privacy" onClick={(e) => e.preventDefault()}>
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="#cookies" onClick={(e) => e.preventDefault()}>
              Cookies Policy
            </a>
            .
          </p>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={!isFormComplete || isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-btn-loading">
                <Loader2 size={15} className="auth-spin" />
                Signing up...
              </span>
            ) : (
              "Sign up"
            )}
          </button>
        </form>

        {successMessage && (
          <div className="auth-success-alert" role="status">
            <CheckCircle2 size={15} />
            <span>{successMessage}</span>
          </div>
        )}

        {formError && (
          <div className="auth-error-alert" role="alert">
            {formError}
          </div>
        )}
      </div>

      {/* Log-in Switch Card */}
      <div className="auth-switch-card">
        Have an account? <Link to="/login">Log in</Link>
      </div>
    </AuthLayout>
  );
}
