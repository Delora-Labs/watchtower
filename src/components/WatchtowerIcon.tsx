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
    <div className={`relative ${className}`} style={{ width: '200px', height: '200px' }}>
      {/* Ambient glow behind everything */}
      <div className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 bg-yellow-500/20 rounded-full blur-3xl" />
      
      {/* Main rotating light beam - cone shaped */}
      <div className="absolute inset-0 animate-beacon-rotate" style={{ transformOrigin: '50% 50%' }}>
        {/* Primary beam - wide cone */}
        <div 
          className="absolute top-1/2 left-1/2 origin-left"
          style={{ 
            width: '180px',
            height: '60px',
            marginTop: '-30px',
            background: 'linear-gradient(90deg, rgba(252,211,77,0.8) 0%, rgba(252,211,77,0.4) 20%, rgba(252,211,77,0.1) 60%, transparent 100%)',
            clipPath: 'polygon(0% 40%, 100% 0%, 100% 100%, 0% 60%)',
            filter: 'blur(8px)',
          }}
        />
        {/* Bright core of beam */}
        <div 
          className="absolute top-1/2 left-1/2 origin-left"
          style={{ 
            width: '160px',
            height: '20px',
            marginTop: '-10px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(252,211,77,0.6) 30%, transparent 100%)',
            filter: 'blur(4px)',
          }}
        />
      </div>
      
      {/* Opposite beam (dimmer) */}
      <div className="absolute inset-0 animate-beacon-rotate" style={{ transformOrigin: '50% 50%' }}>
        <div 
          className="absolute top-1/2 left-1/2 origin-left rotate-180"
          style={{ 
            width: '140px',
            height: '40px',
            marginTop: '-20px',
            background: 'linear-gradient(90deg, rgba(252,211,77,0.5) 0%, rgba(252,211,77,0.2) 30%, transparent 100%)',
            clipPath: 'polygon(0% 35%, 100% 0%, 100% 100%, 0% 65%)',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Center tower icon */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <WatchtowerIcon className="w-20 h-20" />
      </div>
      
      {/* Pulsing glow at light source */}
      <div 
        className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full animate-beacon-pulse"
        style={{ 
          marginTop: '-38px',
          marginLeft: '-24px',
          background: 'radial-gradient(circle, rgba(252,211,77,0.9) 0%, rgba(252,211,77,0.4) 50%, transparent 70%)',
        }}
      />
    </div>
  );
}
