import { ReactNode, useState } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  glowColor?: string;
  isActive?: boolean;
  onClick?: () => void;
  onCollapse?: () => void;
  centerContent?: ReactNode;
}

export const Panel = ({
  title,
  children,
  className = '',
  isActive = false,
  onClick,
  onCollapse,
  centerContent
}: PanelProps) => {
  const [isHovered, setIsHovered] = useState(false);


  return (
    <div
      className={`panel-3d backdrop-blur-xl bg-gradient-to-br from-[#0a0a0a]/90 to-black/70 border border-theme rounded-none overflow-hidden transition-[box-shadow] duration-300 relative group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        transform: 'translateZ(0)',
        boxShadow: isHovered || isActive ? '0 0 30px var(--border-primary)' : '0 0 15px var(--border-primary)'
      }}
    >
      <div className="panel-header bg-theme-secondary/50 border-b border-theme px-4 py-2.5 flex items-center justify-between backdrop-blur-md relative overflow-hidden min-h-[2.5rem] flex-shrink-0">
        <div className="absolute inset-0 bg-theme-accent opacity-[0.03] pointer-events-none"></div>
        <div className="flex items-center space-x-3 relative z-10">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse transition-all bg-theme-accent"
            style={{ boxShadow: `0 0 10px var(--accent-primary)` }}
          ></div>
          <span className="text-theme-accent font-bold font-mono text-xs tracking-widest uppercase transition-colors">
            {title}
          </span>
        </div>

        {/* Center Content */}
        {centerContent && (
          <div className="flex-1 flex items-center justify-center px-4">
            {centerContent}
          </div>
        )}

        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-gray-700 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-gray-700 hover:bg-green-500 transition-colors cursor-pointer"></div>
          <div
            className="w-3 h-3 rounded-full bg-gray-700 hover:bg-red-500 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onCollapse?.();
            }}
          ></div>
        </div>
      </div>
      <div className="panel-content overflow-auto">{children}</div>
    </div>
  );
};
