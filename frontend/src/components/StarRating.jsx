import { useState } from "react";
import { Star } from "lucide-react";

const GOLD = "#f5b301";

/** Read-only star display (supports halves via rounding). */
export function Stars({ value = 0, size = 16, className = "" }) {
  const v = Math.round(value);
  return (
    <span className={`inline-flex items-center ${className}`} aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          fill={i <= v ? GOLD : "none"}
          stroke={GOLD}
        />
      ))}
    </span>
  );
}

/** Interactive star input. */
export function StarInput({ value = 0, onChange, size = 30 }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
          aria-label={`${i} estrella${i > 1 ? "s" : ""}`}
          data-testid={`star-${i}`}
        >
          <Star style={{ width: size, height: size }} fill={i <= active ? GOLD : "none"} stroke={GOLD} />
        </button>
      ))}
    </div>
  );
}
