import React from 'react';

interface InklumeLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'mark' | 'full' | 'stacked';
  theme?: 'dark' | 'light' | 'subtle';
  className?: string;
  showSubtitle?: boolean;
}

export function InklumeLogo({
  size = 'md',
  variant = 'full',
  theme = 'light',
  className = '',
}: InklumeLogoProps) {
  // Dimensions map for the icon mark
  const sizeMap = {
    xs: { icon: 24, text: 'text-base' },
    sm: { icon: 32, text: 'text-xl' },
    md: { icon: 42, text: 'text-2xl' },
    lg: { icon: 54, text: 'text-3xl sm:text-4xl' },
    xl: { icon: 68, text: 'text-4xl sm:text-5xl' },
  };

  const currentSize = sizeMap[size];

  // Colors based on theme
  const textColor = theme === 'dark' ? 'text-[#FAF7F0]' : 'text-[#211F1C]';

  const markSvg = (
    <svg
      width={currentSize.icon}
      height={currentSize.icon}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        {/* Background gradient: deep forest pine teal */}
        <linearGradient id="inklume-bg-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1F4B43" />
          <stop offset="100%" stopColor="#14342E" />
        </linearGradient>

        {/* Gold radiant star gradient */}
        <linearGradient id="inklume-gold-grad" x1="20" y1="16" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D78E" />
          <stop offset="50%" stopColor="#E5B869" />
          <stop offset="100%" stopColor="#C99846" />
        </linearGradient>

        {/* Parchment nib highlight */}
        <linearGradient id="inklume-nib-grad" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FAF7F0" />
          <stop offset="100%" stopColor="#EAE5DA" />
        </linearGradient>
      </defs>

      {/* Rounded Squircle Container */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        fill="url(#inklume-bg-grad)"
        stroke="#EAE5DA"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />

      {/* Subtle background illumination halo */}
      <circle cx="32" cy="28" r="16" fill="url(#inklume-gold-grad)" fillOpacity="0.12" />

      {/* Fountain Pen Nib Body */}
      <path
        d="M32 50 C32 50 19 35 19 23 C19 15.82 24.82 10 32 10 C39.18 10 45 15.82 45 23 C45 35 32 50 32 50 Z"
        fill="url(#inklume-nib-grad)"
      />

      {/* Inner Nib Collar Contour */}
      <path
        d="M24 23 C24 18.58 27.58 15 32 15 C36.42 15 40 18.58 40 23 C40 31 32 42 32 42 C32 42 24 31 24 23 Z"
        fill="#1F4B43"
        fillOpacity="0.12"
      />

      {/* Central Ink Slit running to tip */}
      <line
        x1="32"
        y1="28"
        x2="32"
        y2="50"
        stroke="#1F4B43"
        strokeWidth="1.75"
        strokeLinecap="round"
      />

      {/* Celestial Illuminating Star as Breather Hole */}
      {/* 4-point radiant diamond star */}
      <path
        d="M32 20 C32 23.5 30 25.5 26.5 25.5 C30 25.5 32 27.5 32 31 C32 27.5 34 25.5 37.5 25.5 C34 25.5 32 23.5 32 20 Z"
        fill="url(#inklume-gold-grad)"
      />

      {/* Star Center Glimmer Point */}
      <circle cx="32" cy="25.5" r="1.25" fill="#FAF7F0" />

      {/* Delicate Nib Wing Lines */}
      <path
        d="M22 25 C23.5 29 26.5 34 30 38"
        stroke="#1F4B43"
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M42 25 C40.5 29 37.5 34 34 38"
        stroke="#1F4B43"
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Golden Droplet of Inspiration at the Nib Tip */}
      <circle cx="32" cy="53.5" r="2" fill="url(#inklume-gold-grad)" />
    </svg>
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center ${className}`}>{markSvg}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center text-center gap-3 ${className}`}>
        {markSvg}
        <span className={`font-serif italic font-medium tracking-tight ${currentSize.text} ${textColor}`}>
          Inklume
        </span>
      </div>
    );
  }

  // Full Horizontal Lockup
  return (
    <div className={`inline-flex items-center gap-3.5 ${className}`}>
      {markSvg}
      <span className={`font-serif italic font-medium tracking-tight leading-none ${currentSize.text} ${textColor}`}>
        Inklume
      </span>
    </div>
  );
}
