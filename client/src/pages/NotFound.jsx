import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function NotFound() {
  const { isAuthenticated } = useApp();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
        background: "var(--bg-primary)",
        color: "var(--text-primary)"
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "10px" }}>
        Sorry, this page isn&apos;t available.
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-secondary)",
          maxWidth: "420px",
          marginBottom: "20px",
          lineHeight: "1.5"
        }}
      >
        The link you followed may be broken, or the page may have been removed.
      </p>
      <Link
        to={isAuthenticated ? "/" : "/login"}
        style={{
          padding: "8px 20px",
          borderRadius: "8px",
          background: "var(--accent-blue)",
          color: "#ffffff",
          fontWeight: "600",
          fontSize: "14px",
          textDecoration: "none"
        }}
      >
        {isAuthenticated ? "Go back to Insta-V2" : "Go to Login"}
      </Link>
    </div>
  );
}
