import React from "react";

export default function AuthFooter() {
  const footerLinks = [
    "About",
    "Blog",
    "Jobs",
    "Help",
    "API",
    "Privacy",
    "Terms",
    "Locations",
    "Insta-V2 Lite"
  ];

  return (
    <footer className="auth-footer" aria-label="Footer Navigation">
      <div className="auth-footer-links">
        {footerLinks.map((link) => (
          <a
            key={link}
            href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
            className="auth-footer-link"
            onClick={(e) => e.preventDefault()}
          >
            {link}
          </a>
        ))}
      </div>
      <div className="auth-footer-copyright">
        <select
          className="auth-footer-select"
          aria-label="Select display language"
          defaultValue="en"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="ja">日本語</option>
        </select>
        <span>© 2026 Insta-V2</span>
      </div>
    </footer>
  );
}
