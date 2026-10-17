import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import AuthLayout, { InstagramCameraGlyph } from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import { useApp } from "../context/AppContext";
import { Sparkles } from "lucide-react";

export default function Signup() {
  const { signup, quickDemoLogin, isAuthenticated } = useApp();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    username: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to home
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    // Simulate brief network delay
    setTimeout(() => {
      const result = signup({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      setIsSubmitting(false);

      if (result.success) {
        navigate("/", { replace: true });
      } else {
        setFormError(result.error);
      }
    }, 250);
  };

  const handleQuickDemo = () => {
    quickDemoLogin("insta_creator");
    navigate("/", { replace: true });
  };

  const isFormComplete =
    formData.email.trim() &&
    formData.fullName.trim() &&
    formData.username.trim() &&
    formData.password.length >= 6;

  return (
    <AuthLayout>
      {/* 1. Main Sign-up Card */}
      <div className="auth-card">
        {/* Brand Header */}
        <Link to="/" className="auth-brand-logo" title="Insta-V2">
          <div className="auth-brand-glyph">
            <InstagramCameraGlyph size={32} />
          </div>
          <span className="auth-brand-text">Insta-V2</span>
        </Link>

        {/* Subtitle */}
        <h2 className="auth-subtitle">
          Sign up to see photos and videos from your friends.
        </h2>

        {/* Quick Demo Option */}
        <button
          type="button"
          className="auth-quick-btn"
          onClick={handleQuickDemo}
          title="Instant Demo Access"
        >
          <Sparkles size={16} />
          <span>Quick Demo Login (@insta_creator)</span>
        </button>

        {/* OR Divider */}
        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">OR</span>
          <div className="auth-divider-line" />
        </div>

        {/* Registration Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <AuthInput
            id="signup-email"
            name="email"
            type="email"
            placeholder="Mobile Number or Email"
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
            error={errors.username}
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
            {isSubmitting ? "Signing up..." : "Sign up"}
          </button>
        </form>

        {/* General Error Alert */}
        {formError && (
          <div className="auth-error-alert" role="alert">
            {formError}
          </div>
        )}
      </div>

      {/* 2. Switch to Log-in Card */}
      <div className="auth-switch-card">
        Have an account? <Link to="/login">Log in</Link>
      </div>
    </AuthLayout>
  );
}
