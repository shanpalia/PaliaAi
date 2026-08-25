import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <div id="palia-ai-logo" className={`flex items-center gap-3 select-none ${className}`}>
      {/* Professional Polish Brand Emblem */}
      <div
        className={`relative ${iconSizes[size]} bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-bold tracking-tight text-slate-900 leading-none ${titleSizes[size]}`}>
            Palia <span className="text-blue-600">AI</span>
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">
            by ShanPalia
          </span>
        )}
      </div>
    </div>
  );
};
