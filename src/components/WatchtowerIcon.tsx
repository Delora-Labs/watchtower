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
      {/* Container centered around the icon */}
      <div className="relative" style={{ width: '96px', height: '96px' }}>
        
        {/* Tower icon */}
        <div className="absolute inset-0 z-10">
          <WatchtowerIcon className="w-full h-full" />
        </div>

        {/* Light beam animation - centered on lamp (31.25% from top = 20/64) */}
        <div 
          className="absolute left-1/2 animate-beacon-sweep"
          style={{ 
            top: '31.25%',
            transform: 'translateX(-50%)',
            transformOrigin: 'center center',
            perspective: '300px',
          }}
        >
          {/* Horizontal beam bar */}
          <div 
            className="relative"
            style={{
              width: '240px',
              height: '6px',
              marginLeft: '-120px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(252,211,77,0.3) 20%, rgba(252,211,77,0.9) 50%, rgba(252,211,77,0.3) 80%, transparent 100%)',
              borderRadius: '3px',
              filter: 'blur(2px)',
            }}
          />
          {/* Bright center core */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '16px',
              height: '16px',
              background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(252,211,77,0.8) 50%, transparent 100%)',
              borderRadius: '50%',
            }}
          />
        </div>

        {/* Static glow at lamp position */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 animate-pulse z-5"
          style={{
            top: '31.25%',
            marginTop: '-8px',
            width: '16px',
            height: '16px',
            background: 'radial-gradient(circle, rgba(252,211,77,0.8) 0%, rgba(252,211,77,0.3) 50%, transparent 100%)',
            borderRadius: '50%',
            filter: 'blur(4px)',
          }}
        />
      </div>
    </div>
  );
}
