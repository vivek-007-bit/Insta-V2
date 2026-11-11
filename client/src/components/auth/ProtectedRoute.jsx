import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, authenticationLoading } = useApp();
  const location = useLocation();

  if (authenticationLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg-primary)"
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid var(--border-subtle)",
            borderTopColor: "var(--accent-blue)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated user to /login with attempted location state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
