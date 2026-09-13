import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Loading admin" className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-8xl space-y-6">
        <Skeleton className="h-10 w-56" />

        {/* Tab strip. */}
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-full" />
          ))}
        </div>

        {/* Report rows. */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-foreground/10 p-4"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
