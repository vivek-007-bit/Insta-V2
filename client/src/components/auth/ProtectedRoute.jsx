import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect unauthenticated user to /login with attempted location state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
