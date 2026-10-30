import React from "react";

/**
 * HealPointBrandLogo
 * 
 * Crisp, vector healthcare identity matching the HealPoint brand reference:
 * - Heart emblem with medical cross in cyan/blue (#0284C7 / #00B4D8)
 * - Professional wordmark "HealPoint"
 * - Tagline "Care Today, Healthier Tomorrow"
 */
export const HealPointEmblem = ({ size = 36, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0 }}
    role="img"
    aria-label="HealPoint Logo"
  >
    <defs>
      <linearGradient id="hpHeartGrad" x1="8" y1="8" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0EA5E9" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
      <filter id="hpSoftGlow" x="4" y="5" width="32" height="32" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0284C7" floodOpacity="0.25" />
      </filter>
    </defs>
    <path
      d="M20 33C20 33 7 24.5 7 15.5C7 11.3579 10.3579 8 14.5 8C17 8 19.1 9.4 20 10.7C20.9 9.4 23 8 25.5 8C29.6421 8 33 11.3579 33 15.5C33 24.5 20 33 20 33Z"
      fill="url(#hpHeartGrad)"
      filter="url(#hpSoftGlow)"
    />
    <path
      d="M20 12.5V23.5M14.5 18H25.5"
      stroke="#FFFFFF"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HealPointBrandLogo = ({
  size = 38,
  showTagline = true,
  className = "",
  taglineText = "Care Today, Healthier Tomorrow",
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
          Heal<span style={{ color: "#0284C7" }}>Point</span>
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 500,
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

