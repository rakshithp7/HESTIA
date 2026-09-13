import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage
      label="Loading session"
      className="px-6 py-0 md:py-8 md:px-12"
    >
      <div className="mx-auto mt-16 max-w-2xl space-y-6">
        {/* Peer header. */}
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Message stream. */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}
            >
              <Skeleton
                className={`h-12 rounded-2xl ${i % 2 === 0 ? 'w-3/5' : 'w-2/5'}`}
              />
            </div>
          ))}
        </div>

        {/* Composer. */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 flex-1 rounded-md" />
          <Skeleton className="size-11 shrink-0 rounded-md" />
        </div>
      </div>
    </SkeletonPage>
  );
}
