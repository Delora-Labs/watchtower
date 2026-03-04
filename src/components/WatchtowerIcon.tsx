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
    <div className={`relative ${className}`} style={{ perspective: '500px' }}>
      {/* 3D Light beam - horizontal sweep POV */}
      <div 
        className="absolute inset-0 animate-beacon-sweep"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Main beam cone */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 origin-center"
          style={{
            width: '300px',
            height: '80px',
            marginTop: '-70px',
            background: 'linear-gradient(180deg, rgba(252,211,77,0.9) 0%, rgba(252,211,77,0.4) 40%, transparent 100%)',
            clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
            filter: 'blur(4px)',
          }}
        />
        {/* Bright center of beam */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 animate-beacon-intensity"
          style={{
            width: '150px',
            height: '60px',
            marginTop: '-65px',
            background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(252,211,77,0.6) 50%, transparent 100%)',
            clipPath: 'polygon(45% 0%, 55% 0%, 85% 100%, 15% 100%)',
          }}
        />
      </div>

      {/* Light source flare */}
      <div 
        className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full animate-beacon-flare"
        style={{
          marginTop: '-40px',
          background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(252,211,77,0.8) 30%, transparent 70%)',
        }}
      />
      
      {/* Center tower icon */}
      <div className="relative z-10">
        <WatchtowerIcon className="w-24 h-24" />
      </div>
      
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-yellow-400/30 rounded-full blur-xl" />
    </div>
  );
}
