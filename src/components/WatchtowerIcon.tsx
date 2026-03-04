"use client";

export function WatchtowerIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Tower base */}
      <path
        d="M20 58 L24 28 L40 28 L44 58 Z"
        fill="url(#towerGradient)"
        stroke="#60A5FA"
        strokeWidth="2"
      />
      {/* Tower middle section */}
      <rect x="22" y="28" width="20" height="8" fill="#1E3A5F" stroke="#60A5FA" strokeWidth="1.5" />
      {/* Tower top/lamp house */}
      <rect x="24" y="16" width="16" height="12" rx="2" fill="#1E3A5F" stroke="#60A5FA" strokeWidth="2" />
      {/* Lamp dome */}
      <path
        d="M26 16 Q32 8 38 16"
        fill="none"
        stroke="#60A5FA"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Light glow center */}
      <circle cx="32" cy="20" r="4" fill="#FCD34D" />
      {/* Windows */}
      <rect x="29" y="34" width="6" height="8" rx="1" fill="#0F172A" stroke="#60A5FA" strokeWidth="1" />
      <rect x="29" y="46" width="6" height="8" rx="1" fill="#0F172A" stroke="#60A5FA" strokeWidth="1" />
      {/* Gradient definition */}
      <defs>
        <linearGradient id="towerGradient" x1="32" y1="28" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E3A5F" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function WatchtowerBeacon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Spinning light beams - large and dramatic */}
      <div className="absolute inset-0 animate-spin-slow">
        <div className="absolute top-1/2 left-1/2 w-80 h-2 -translate-x-1/2 -translate-y-1/2 origin-left">
          <div className="w-full h-full bg-gradient-to-r from-yellow-400/70 via-yellow-400/30 to-transparent rounded-full blur-md" />
        </div>
        <div className="absolute top-1/2 left-1/2 w-80 h-2 -translate-x-1/2 -translate-y-1/2 origin-left rotate-180">
          <div className="w-full h-full bg-gradient-to-r from-yellow-400/70 via-yellow-400/30 to-transparent rounded-full blur-md" />
        </div>
      </div>
      {/* Secondary dimmer beams for depth */}
      <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: '-2s' }}>
        <div className="absolute top-1/2 left-1/2 w-64 h-1 -translate-x-1/2 -translate-y-1/2 origin-left rotate-45">
          <div className="w-full h-full bg-gradient-to-r from-yellow-300/40 via-yellow-300/10 to-transparent rounded-full blur-sm" />
        </div>
        <div className="absolute top-1/2 left-1/2 w-64 h-1 -translate-x-1/2 -translate-y-1/2 origin-left -rotate-135">
          <div className="w-full h-full bg-gradient-to-r from-yellow-300/40 via-yellow-300/10 to-transparent rounded-full blur-sm" />
        </div>
      </div>
      {/* Center tower icon - bigger */}
      <div className="relative z-10">
        <WatchtowerIcon className="w-24 h-24" />
      </div>
      {/* Main glow effect - larger and brighter */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-400/40 rounded-full blur-xl animate-pulse" />
      {/* Inner glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-yellow-300/60 rounded-full blur-md animate-pulse" />
    </div>
  );
}
