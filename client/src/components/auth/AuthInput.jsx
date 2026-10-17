import React, { useState } from "react";

export default function AuthInput({
  id,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  required = false
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const inputId = id || name;
  const errorId = `${inputId}-error`;

  return (
    <div className="auth-input-group">
      <div className="auth-input-wrapper">
        <input
          id={inputId}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`auth-input ${error ? "has-error" : ""}`}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
        {isPassword && value.length > 0 && (
          <button
            type="button"
            className="auth-input-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="auth-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
