import { useEffect, useState } from 'react';

export const SplashScreen = () => {
  // Phase is managed by App.tsx, this component just shows the animation
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('INITIALIZING');
  const [ringRotation, setRingRotation] = useState(0);

  useEffect(() => {
    const ringInterval = setInterval(() => {
      setRingRotation(prev => (prev + 2) % 360);
    }, 16);

    const stages = [
      { delay: 300, progress: 20, status: 'LOADING KERNEL' },
      { delay: 600, progress: 40, status: 'MOUNTING FILE SYSTEM' },
      { delay: 900, progress: 60, status: 'INITIALIZING AI CORE' },
      { delay: 1200, progress: 80, status: 'LOADING EDITOR ENGINE' },
      { delay: 1500, progress: 100, status: 'SYSTEM READY' },
    ];

    stages.forEach(({ delay, progress, status }) => {
      setTimeout(() => {
        setProgress(progress);
        setStatus(status);
      }, delay);
    });

    // Cleanup on unmount
    return () => clearInterval(ringInterval);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-red-950/20 to-black"></div>

      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scan"
            style={{
              top: `${i * 5}%`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '2s',
            }}
          />
        ))}
      </div>

      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-40 h-40 opacity-30 pointer-events-none">
        <div
          className="w-full h-full border-2 border-red-500/30 rounded-full absolute"
          style={{ animation: 'spin 4s linear infinite' }}
        />
        <div
          className="w-full h-full border-2 border-transparent border-t-red-500/50 rounded-full absolute"
          style={{
            animation: 'spin 3s linear infinite reverse',
            transform: `rotate(${ringRotation}deg)`,
          }}
        />
      </div>

      <div className="relative z-10 text-center">
        <div className="mb-8 animate-pulse-glow">
          <div className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-600 to-red-700 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]">
            HENU
          </div>
          <div className="text-2xl text-red-500/80 tracking-[0.5em] mt-2 font-light">
            OS
          </div>
          <div className="text-xs text-red-600/60 mt-4 tracking-wider font-mono">
            NEURAL CORE ONLINE
          </div>
        </div>

        <div className="w-96 mx-auto space-y-6">
          <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-red-900/30">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="space-y-2">
            <div className="text-red-400/60 text-sm font-mono tracking-wider">
              {status}
              <span className="animate-ping">_</span>
            </div>

            <div className="flex items-center justify-center space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-red-500 rounded-full"
                  style={{
                    animation: 'pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 text-xs text-gray-600 font-mono">
          <div>AI DEVELOPMENT OPERATING SYSTEM</div>
          <div className="mt-1">v1.0.0 | CYBERPUNK EDITION</div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(239, 68, 68, 0.5)); }
          50% { filter: drop-shadow(0 0 50px rgba(239, 68, 68, 0.8)); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
