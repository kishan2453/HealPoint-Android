import React from "react";

export const HealPointEmblem = ({ size = 36, className = "" }) => (
  <img
    src="/logo.png"
    alt="HealPoint Logo"
    width={size}
    height={size}
    className={className}
    style={{ objectFit: "contain", flexShrink: 0, borderRadius: 8 }}
  />
);

const HealPointBrandLogo = ({
  size = 38,
  showTagline = true,
  className = "",
  taglineText = "Your Health, Our Priority",
}) => {
  return (
    <div
      className={`hp-brand-lockup ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        userSelect: "none",
      }}
    >
      <HealPointEmblem size={size} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#0F172A",
            fontFamily: "inherit",
          }}
        >
          Heal<span style={{ color: "#2563EB" }}>Point</span>
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color: "#64748B",
              marginTop: "2px",
              letterSpacing: "0.01em",
            }}
          >
            {taglineText}
          </span>
        )}
      </div>
    </div>
  );
};

export default HealPointBrandLogo;
