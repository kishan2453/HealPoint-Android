import React from "react";

/**
 * HospitalHeroIllustration
 * 
 * Crisp vector medical architectural center matching the reference hero banner:
 * - Multi-story modern healthcare center facade with glass panels and entrance
 * - HealPoint cross emblem on rooftop / upper facade
 * - Decorative landscape accents and floating healthcare pill
 */
const HospitalHeroIllustration = ({ className = "" }) => {
  return (
    <div className={`sa-hero-illustration-wrap ${className}`}>
      <svg
        viewBox="0 0 460 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="sa-hero-hospital-svg"
        role="img"
        aria-label="HealPoint Modern Hospital Center"
      >
        <defs>
          <linearGradient id="skyGlow" x1="230" y1="0" x2="230" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="mainTower" x1="160" y1="30" x2="300" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>
          <linearGradient id="wingLeft" x1="80" y1="80" x2="160" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="wingRight" x1="300" y1="90" x2="380" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="glassTone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.65" />
          </linearGradient>
          <linearGradient id="glassAcc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BAE6FD" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
          <linearGradient id="blueBase" x1="100" y1="230" x2="360" y2="250" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <filter id="softShadow" x="50" y="20" width="360" height="240" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Soft Background Accent Ground */}
        <ellipse cx="230" cy="235" rx="190" ry="18" fill="#E2E8F0" opacity="0.6" />

        {/* Trees & Landscaping */}
        <g opacity="0.9">
          {/* Left Tree */}
          <rect x="68" y="195" width="6" height="35" rx="2" fill="#94A3B8" />
          <circle cx="71" cy="180" r="22" fill="#10B981" opacity="0.85" />
          <circle cx="82" cy="172" r="16" fill="#34D399" opacity="0.9" />

          {/* Right Tree */}
          <rect x="388" y="195" width="6" height="35" rx="2" fill="#94A3B8" />
          <circle cx="391" cy="180" r="22" fill="#10B981" opacity="0.85" />
          <circle cx="380" cy="172" r="16" fill="#34D399" opacity="0.9" />
        </g>

        {/* Hospital Building Structure with Drop Shadow */}
        <g filter="url(#softShadow)">
          {/* Left Wing */}
          <rect x="90" y="85" width="80" height="145" rx="6" fill="url(#wingLeft)" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Left Wing Windows */}
          <rect x="104" y="105" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="134" y="105" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="104" y="140" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="134" y="140" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="104" y="175" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="134" y="175" width="18" height="22" rx="3" fill="url(#glassTone)" />

          {/* Right Wing */}
          <rect x="290" y="95" width="80" height="135" rx="6" fill="url(#wingRight)" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Right Wing Windows */}
          <rect x="304" y="115" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="334" y="115" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="304" y="150" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="334" y="150" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="304" y="185" width="18" height="22" rx="3" fill="url(#glassTone)" />
          <rect x="334" y="185" width="18" height="22" rx="3" fill="url(#glassTone)" />

          {/* Central Main Hospital Tower */}
          <rect x="155" y="38" width="150" height="195" rx="8" fill="url(#mainTower)" stroke="#94A3B8" strokeWidth="1.5" />

          {/* Rooftop Medical Cross Sign */}
          <rect x="210" y="18" width="40" height="26" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
          <path d="M230 22V38M222 30H238" stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" />

          {/* Center Tower Facade Header Band */}
          <rect x="165" y="52" width="130" height="16" rx="3" fill="#E0F2FE" />
          <text x="230" y="64" textAnchor="middle" fill="#0369A1" fontSize="9" fontWeight="700" letterSpacing="1">
            HEALPOINT MEDICAL
          </text>

          {/* Curtain Wall Glass Window Grid */}
          <g>
            <rect x="175" y="80" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="205" y="80" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="235" y="80" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="265" y="80" width="22" height="24" rx="3" fill="url(#glassTone)" />

            <rect x="175" y="114" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="205" y="114" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="235" y="114" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="265" y="114" width="22" height="24" rx="3" fill="url(#glassTone)" />

            <rect x="175" y="148" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="205" y="148" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="235" y="148" width="22" height="24" rx="3" fill="url(#glassTone)" />
            <rect x="265" y="148" width="22" height="24" rx="3" fill="url(#glassTone)" />
          </g>

          {/* Entrance Canopy & Revolving Glass Doors */}
          <polygon points="175,190 285,190 295,200 165,200" fill="#0284C7" />
          <rect x="195" y="200" width="70" height="33" rx="2" fill="#E2E8F0" stroke="#CBD5E1" />
          <rect x="205" y="204" width="22" height="29" rx="1" fill="url(#glassAcc)" />
          <rect x="233" y="204" width="22" height="29" rx="1" fill="url(#glassAcc)" />
          <line x1="227" y1="204" x2="227" y2="233" stroke="#94A3B8" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Floating Healthcare Pill Overlay */}
      <div className="sa-hero-pill-badge">
        <span className="sa-hero-pill-dot" />
        <span className="sa-hero-pill-text">Connecting People to Better Healthcare</span>
      </div>
    </div>
  );
};

export default HospitalHeroIllustration;

