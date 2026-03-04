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
    <div className={`relative ${className}`} style={{ perspective: '500px', width: '96px', height: '96px' }}>
      {/* Center tower icon - positioned first for reference */}
      <div className="absolute inset-0 z-10">
        <WatchtowerIcon className="w-24 h-24" />
      </div>

      {/* 3D Light beam - aligned with lamp (top 30% of icon) */}
      <div 
        className="absolute animate-beacon-sweep"
        style={{ 
          transformStyle: 'preserve-3d',
          top: '30px',  /* Align with lamp position on icon */
          left: '48px', /* Center horizontally */
          transformOrigin: 'center center',
        }}
      >
        {/* Main beam cone - pointing upward from lamp */}
        <div 
          className="origin-bottom"
          style={{
            width: '200px',
            height: '60px',
            marginLeft: '-100px',
            marginTop: '-60px',
            background: 'linear-gradient(0deg, rgba(252,211,77,0.9) 0%, rgba(252,211,77,0.4) 50%, transparent 100%)',
            clipPath: 'polygon(35% 100%, 65% 100%, 100% 0%, 0% 0%)',
            filter: 'blur(3px)',
          }}
        />
        {/* Bright center of beam */}
        <div 
          className="absolute animate-beacon-intensity origin-bottom"
          style={{
            width: '120px',
            height: '50px',
            left: '-60px',
            top: '-50px',
            background: 'linear-gradient(0deg, rgba(255,255,255,1) 0%, rgba(252,211,77,0.5) 60%, transparent 100%)',
            clipPath: 'polygon(40% 100%, 60% 100%, 90% 0%, 10% 0%)',
          }}
        />
      </div>

      {/* Light source flare - at lamp position */}
      <div 
        className="absolute w-10 h-10 rounded-full animate-beacon-flare"
        style={{
          top: '22px',
          left: '50%',
          marginLeft: '-20px',
          background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(252,211,77,0.8) 40%, transparent 70%)',
        }}
      />
      
      {/* Ambient glow at lamp */}
      <div 
        className="absolute w-8 h-8 bg-yellow-400/40 rounded-full blur-lg"
        style={{ top: '24px', left: '50%', marginLeft: '-16px' }}
      />
    </div>
  );
}
