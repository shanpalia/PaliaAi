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

  const logoUrl = `${import.meta.env.BASE_URL}palia-ai-logo.svg`;
  const iconUrl = `${import.meta.env.BASE_URL}palia-ai-icon.svg`;

  return (
    <div id="palia-ai-logo" className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src={showSubtitle ? logoUrl : iconUrl}
        alt="Palia AI"
        className={`${showSubtitle ? 'w-auto max-w-[190px]' : iconSizes[size]} h-auto object-contain flex-shrink-0`}
      />
    </div>
  );
};