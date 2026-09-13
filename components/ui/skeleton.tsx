import { cn } from '@/lib/utils';

/**
 * Placeholder block shown while real content loads.
 *
 * Pulsing is handled by the `skeleton-pulse` class in globals.css rather than
 * Tailwind's `animate-pulse`, so it can be switched off under
 * `prefers-reduced-motion` in one place.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'skeleton-pulse rounded-md bg-foreground/10 dark:bg-foreground/15',
        className
      )}
      {...props}
    />
  );
}

/**
 * Several skeleton lines at slightly different widths, so a loading paragraph
 * does not read as a solid block.
 */
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-10/12', 'w-3/4'];

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', widths[i % widths.length], {
            'w-2/5': i === lines - 1 && lines > 1,
          })}
        />
      ))}
    </div>
  );
}

/**
 * Wrapper that announces loading to screen readers. The skeletons themselves
 * are `aria-hidden`, so without this a route transition would be silent.
 */
function SkeletonPage({
  children,
  label = 'Loading',
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={cn('skeleton-fade-in', className)}
    >
      {children}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonPage };
