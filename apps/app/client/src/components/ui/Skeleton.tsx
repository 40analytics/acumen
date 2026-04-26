import { cn } from '@/lib/cn';

/**
 * Generic shimmer placeholder for loading states.
 *
 * Usage:
 *   <Skeleton className="h-9 w-28" />
 *   <Skeleton className="h-4 w-full" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-border-soft',
        className,
      )}
    />
  );
}
