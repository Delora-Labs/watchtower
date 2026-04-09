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
      <circle cx="32" cy="20" r="6" fill="#FCD34D" />
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
  // Lamp position: SVG cy=20 in 64x64 viewBox = 31.25% from top, cx=32 = 50% from left
  return (
    <div className={`relative w-24 h-24 ${className}`}>
      {/* Rotating beams - positioned at lamp, behind the icon */}
      <div
        className="absolute animate-beacon-rotate"
        style={{
          top: '31.25%',
          left: '50%',
          width: '0',
          height: '0',
        }}
      >
        {/* Beam 1 */}
        <div
          style={{
            position: 'absolute',
            top: '-3px',
            left: '0',
            width: '120px',
            height: '6px',
            background: 'linear-gradient(90deg, rgba(252,211,77,0.95) 0%, rgba(252,211,77,0.5) 40%, rgba(252,211,77,0.1) 70%, transparent 100%)',
            borderRadius: '0 3px 3px 0',
            filter: 'blur(1px)',
            transformOrigin: '0 50%',
          }}
        />
        {/* Beam 2 (opposite) */}
        <div
          style={{
            position: 'absolute',
            top: '-3px',
            right: '0',
            width: '120px',
            height: '6px',
            background: 'linear-gradient(270deg, rgba(252,211,77,0.95) 0%, rgba(252,211,77,0.5) 40%, rgba(252,211,77,0.1) 70%, transparent 100%)',
            borderRadius: '3px 0 0 3px',
            filter: 'blur(1px)',
            transformOrigin: '100% 50%',
          }}
        />
      </div>

      {/* Lamp glow - pulsing, large enough to spill onto adjacent text */}
      <div
        className="absolute z-20 animate-pulse pointer-events-none"
        style={{
          top: '31.25%',
          left: '50%',
          width: '220%',
          height: '220%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(255,255,200,0.95) 0%, rgba(252,211,77,0.7) 15%, rgba(252,211,77,0.35) 35%, rgba(252,211,77,0.1) 60%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(6px)',
        }}
      />

      {/* Tower icon - on top */}
      <div className="absolute inset-0 z-10">
        <WatchtowerIcon className="w-full h-full" />
      </div>
    </div>
  );
}
