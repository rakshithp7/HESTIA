import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Loading profile" className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-8xl">
        <Skeleton className="mb-6 h-10 w-40" />

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Section nav. */}
          <aside className="w-full md:w-1/4">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>

            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}

            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
