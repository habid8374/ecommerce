import { useState } from "react";

/**
 * Axentia brand mark.
 *
 * Prefers the real logo file at `public/axentia-logo.png` (drop it there and it
 * appears automatically). Until that file exists, it falls back to an inline SVG
 * approximation so the layout never breaks.
 */
export default function AxentiaLogo({ size = 20, className = "" }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src="/axentia-logo.png"
        alt="Axentia"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: "contain", display: "block" }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-label="Axentia" role="img">
      <rect x="14" y="5" width="12" height="39" rx="5" fill="#1e2d3d" transform="rotate(20 24 24)" />
      <rect x="30" y="15" width="9" height="28" rx="4" fill="#1f8f9e" transform="rotate(-14 24 24)" />
    </svg>
  );
}
