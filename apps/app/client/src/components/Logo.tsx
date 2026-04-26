import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 28, stroke: 2.4, font: 14 },
  md: { box: 32, stroke: 2.4, font: 17 },
  lg: { box: 44, stroke: 2.6, font: 22 },
} as const;

export function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="rounded-md bg-ink flex items-center justify-center"
        style={{ width: s.box, height: s.box }}
      >
        <svg viewBox="0 0 36 36" fill="none" width={s.box * 0.55} height={s.box * 0.55}>
          <g
            stroke="#EDF1E7"
            strokeWidth={s.stroke}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M 18 9 L 9 27" />
            <path d="M 18 9 L 27 27" />
            <path d="M 13 20 L 23 20" />
          </g>
        </svg>
      </span>
      {showWordmark && (
        <span
          className="font-bold tracking-tight text-ink"
          style={{ fontSize: s.font, letterSpacing: '-0.4px' }}
        >
          Acumen
        </span>
      )}
    </div>
  );
}
