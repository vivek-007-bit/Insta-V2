import React from "react";
import { User, Bell, Lock, Palette, Shield, HelpCircle, LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Settings() {
  const { theme, toggleTheme, setIsEditProfileOpen, showToast, logout } = useApp();

  return (
    <div style={{ width: "100%", maxWidth: "700px", padding: "30px 20px" }}>
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: "700", marginBottom: "24px" }}>
        Settings
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Edit Profile Section */}
        <div
          onClick={() => setIsEditProfileOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <User size={20} style={{ color: "var(--text-secondary)" }} />
            <div>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>Edit Profile</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Name, bio, website, and profile image
              </div>
            </div>
          </div>
          <span style={{ color: "var(--accent-blue)", fontSize: "var(--font-size-sm)", fontWeight: "600" }}>Edit</span>
        </div>

        {/* Appearance Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Palette size={20} style={{ color: "var(--text-secondary)" }} />
            <div>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>Appearance</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Current theme: <strong style={{ textTransform: "capitalize" }}>{theme} mode</strong>
              </div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--accent-gray-btn)",
              fontSize: "var(--font-size-sm)",
              fontWeight: "600"
            }}
          >
            Switch to {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>

        {/* Notifications Preference */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Bell size={20} style={{ color: "var(--text-secondary)" }} />
            <div>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>Push Notifications</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Pause all notifications for this demo session
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            defaultChecked
            onChange={(e) => showToast(e.target.checked ? "Notifications active" : "Notifications paused")}
            style={{ cursor: "pointer", width: "18px", height: "18px" }}
          />
        </div>

        {/* Privacy & Security */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Lock size={20} style={{ color: "var(--text-secondary)" }} />
            <div>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>Account Privacy</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Public account (Visible to everyone on Insta-V2)
              </div>
            </div>
          </div>
          <button
            onClick={() => showToast("Account privacy is simulated in demo")}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--accent-gray-btn)",
              fontSize: "var(--font-size-sm)",
              fontWeight: "600"
            }}
          >
            Manage
          </button>
        </div>

        {/* Security / Help */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Shield size={20} style={{ color: "var(--text-secondary)" }} />
            <div>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)" }}>Security Notice</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "2px" }}>
                Insta-V2 Frontend Prototype — No real backend or database credentials attached.
              </div>
            </div>
          </div>
        </div>

        {/* Log Out Action */}
        <div
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <LogOut size={20} style={{ color: "var(--accent-red)" }} />
            <div>
              <div style={{ fontWeight: "600", fontSize: "var(--font-size-base)", color: "var(--accent-red)" }}>
                Log Out
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: "2px" }}>
                End demo session and return to Login
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
