import React, { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function AuthInput({
  id,
  name,
  type = "text",
  value = "",
  onChange,
  onBlur,
  placeholder,
  error,
  status = null, // null | "checking" | "available" | "unavailable"
  autoComplete,
  required = false
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const inputId = id || name;
  const errorId = `${inputId}-error`;
  const hasValue = String(value).length > 0;
  const hasAdornment = isPassword && hasValue ? true : Boolean(status);

  return (
    <div className="auth-input-group">
      <label
        htmlFor={inputId}
        className={`auth-input-box ${hasValue ? "has-value" : ""} ${error ? "has-error" : ""}`}
      >
        <span className="auth-floating-label">{placeholder}</span>
        <input
          id={inputId}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder=" "
          className={`auth-input ${hasAdornment ? "with-adornment" : ""}`}
          autoComplete={autoComplete}
          required={required}
          aria-label={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />

        <div className="auth-input-adornments">
          {status === "checking" && (
            <Loader2 size={16} className="auth-status-icon auth-spin" aria-label="Checking availability" />
          )}
          {status === "available" && (
            <CheckCircle2 size={18} className="auth-status-icon is-valid" aria-label="Available" />
          )}
          {status === "unavailable" && (
            <XCircle size={18} className="auth-status-icon is-invalid" aria-label="Unavailable" />
          )}
          {isPassword && hasValue && (
            <button
              type="button"
              className="auth-input-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          )}
        </div>
      </label>

      {error && (
        <span id={errorId} className="auth-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
