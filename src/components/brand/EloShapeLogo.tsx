import { cn } from "@/lib/utils";

/**
 * Geometric "ES" mark placeholder — faceted shield/gem split between metallic
 * silver (E) and brand orange/gold (S). Pure SVG so it scales and themes.
 */
export function EloShapeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 76"
      role="img"
      aria-label="EloShape"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="es-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.93 0.006 265)" />
          <stop offset="100%" stopColor="oklch(0.62 0.012 265)" />
        </linearGradient>
        <linearGradient id="es-brand" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.845 0.135 82)" />
          <stop offset="100%" stopColor="oklch(0.62 0.15 45)" />
        </linearGradient>
      </defs>

      {/* left half — E */}
      <g fill="url(#es-silver)">
        <path d="M31 3 L9 19 L9 57 L31 73 L31 63 L18 53 L18 23 L31 13 Z" />
        <path d="M22 27 L31 20 L31 29 L26 33 L31 33 L31 41 L22 41 Z" />
        <path d="M22 46 L31 46 L31 54 L31 57 L22 51 Z" />
      </g>
      {/* right half — S */}
      <g fill="url(#es-brand)">
        <path d="M33 3 L55 19 L55 57 L33 73 L33 63 L46 53 L46 23 L33 13 Z" />
        <path d="M33 20 L42 27 L42 33 L36 33 L42 37 L42 47 L33 54 L33 46 L36 43 L33 41 L33 33 Z" />
      </g>
      {/* accent slivers */}
      <path d="M4 26 L7 24 L7 50 L4 47 Z" fill="url(#es-silver)" opacity="0.7" />
      <path d="M60 26 L57 24 L57 50 L60 47 Z" fill="url(#es-brand)" opacity="0.7" />
    </svg>
  );
}

export function EloShapeLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <EloShapeMark />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="text-base font-black tracking-tight text-foreground">
            Elo<span className="text-brand-gradient">Shape</span>
          </span>
          <span className="eyebrow mt-1 text-[0.5625rem]">Competitive circuit</span>
        </span>
      ) : null}
    </span>
  );
}
