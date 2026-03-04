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
  // Icon is 64x64 viewBox rendered at 96x96
  // Light center in SVG: cx=32, cy=20
  // At 96px: x=48px (center), y=30px from top
  
  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        width: '96px', 
        height: '96px',
        perspective: '400px',
      }}
    >
      {/* Tower icon (z-index 10 to be on top) */}
      <div className="absolute inset-0 z-10">
        <WatchtowerIcon className="w-24 h-24" />
      </div>

      {/* 3D Beam container - positioned at lamp location */}
      {/* Lamp is at y=30px from top, centered horizontally */}
      <div 
        className="absolute"
        style={{ 
          top: '30px',
          left: '48px',
          width: '0px',
          height: '0px',
        }}
      >
        {/* Sweeping beam - rotates around Y axis for 3D effect */}
        <div 
          className="animate-beacon-sweep"
          style={{ 
            transformStyle: 'preserve-3d',
            transformOrigin: '0 0',
          }}
        >
          {/* Left beam */}
          <div 
            style={{
              position: 'absolute',
              width: '150px',
              height: '8px',
              left: '0',
              top: '-4px',
              background: 'linear-gradient(90deg, rgba(252,211,77,0.9) 0%, rgba(252,211,77,0.3) 60%, transparent 100%)',
              borderRadius: '4px',
              filter: 'blur(2px)',
            }}
          />
          {/* Right beam (opposite direction) */}
          <div 
            style={{
              position: 'absolute',
              width: '150px',
              height: '8px',
              right: '0',
              top: '-4px',
              transform: 'rotate(180deg)',
              transformOrigin: '0 50%',
              background: 'linear-gradient(90deg, rgba(252,211,77,0.9) 0%, rgba(252,211,77,0.3) 60%, transparent 100%)',
              borderRadius: '4px',
              filter: 'blur(2px)',
            }}
          />
        </div>
      </div>

      {/* Pulsing glow at lamp - exactly at light position */}
      <div 
        className="absolute animate-beacon-flare z-20"
        style={{
          top: '24px',
          left: '42px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(252,211,77,0.9) 50%, transparent 100%)',
          boxShadow: '0 0 20px 8px rgba(252,211,77,0.6)',
        }}
      />
    </div>
  );
}
