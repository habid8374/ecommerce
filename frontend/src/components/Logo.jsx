import { useId } from "react";

/**
 * GRAFIBLESS logo.
 *
 * <LogoMark />  – the GB monogram only (scales with `size`).
 * <Logo />      – monogram + "GRAFIBLESS" wordmark (horizontal by default).
 *
 * Palette: silver/white "G", royal-blue "B" (brand blue = hsl(223 100% 56%)).
 */
export function LogoMark({ size = 36, className = "" }) {
  const uid = useId().replace(/:/g, "");
  const silver = `silver-${uid}`;
  const blue = `blue-${uid}`;
  return (
    <svg
      viewBox="0 0 200 160"
      width={(size * 200) / 160}
      height={size}
      className={className}
      role="img"
      aria-label="GRAFIBLESS"
    >
      <defs>
        <linearGradient id={silver} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#c6ccd3" />
        </linearGradient>
        <linearGradient id={blue} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e6bff" />
          <stop offset="1" stopColor="#1140e6" />
        </linearGradient>
      </defs>
      {/* G */}
      <path
        fill="none"
        stroke={`url(#${silver})`}
        strokeWidth="30"
        strokeLinecap="round"
        d="M 100 27 H 60 A 40 40 0 0 0 20 67 V 93 A 40 40 0 0 0 60 133 H 100"
      />
      <rect x="70" y="67" width="31" height="26" rx="5" fill={`url(#${silver})`} />
      {/* B */}
      <rect x="109" y="27" width="26" height="106" rx="9" fill={`url(#${blue})`} />
      <path
        fill="none"
        stroke={`url(#${blue})`}
        strokeWidth="28"
        strokeLinecap="round"
        d="M 128 41 H 150 A 26 26 0 0 1 150 80 H 128"
      />
      <path
        fill="none"
        stroke={`url(#${blue})`}
        strokeWidth="28"
        strokeLinecap="round"
        d="M 128 80 H 152 A 27 27 0 0 1 152 119 H 128"
      />
    </svg>
  );
}

export default function Logo({ size = 34, className = "", wordClassName = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className={`font-extrabold tracking-tight leading-none ${wordClassName}`}
        style={{ fontSize: size * 0.62 }}
      >
        <span>GRAFI</span>
        <span className="text-primary">BLESS</span>
      </span>
    </span>
  );
}
