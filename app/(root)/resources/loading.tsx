import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Loading resources" className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-8xl">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="mb-4 h-10 w-48" />
          <Skeleton className="mb-3 h-10 w-32 md:w-64" />
        </div>

        <div className="hidden h-[calc(100vh-14rem)] gap-8 md:flex">
          <aside className="w-1/4 self-start">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-3/4" />
              ))}
            </div>
          </aside>

          <div className="flex-1 space-y-8">
            {Array.from({ length: 3 }).map((_, section) => (
              <div key={section} className="space-y-4">
                <Skeleton className="h-7 w-56" />
                {Array.from({ length: 3 }).map((_, entry) => (
                  <div key={entry} className="space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-2/5" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
