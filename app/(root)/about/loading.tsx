import { Skeleton, SkeletonText, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Loading about" className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-8xl space-y-10">
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <SkeletonText lines={3} />
        </div>

        {/* FAQ accordion rows. */}
        <div className="space-y-3">
          <Skeleton className="h-8 w-56" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-foreground/10 py-4"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="size-4 shrink-0 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
