/**
 * Axentia brand mark (stylized "A": navy left blade + teal right blade).
 * Recreated as an inline SVG so it stays crisp at any size. Swap for the
 * official PNG/SVG later if needed.
 */
export default function AxentiaLogo({ size = 20, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-label="Axentia"
      role="img"
    >
      <rect x="14" y="5" width="12" height="39" rx="5" fill="#1e2d3d" transform="rotate(20 24 24)" />
      <rect x="30" y="15" width="9" height="28" rx="4" fill="#1f8f9e" transform="rotate(-14 24 24)" />
    </svg>
  );
}
