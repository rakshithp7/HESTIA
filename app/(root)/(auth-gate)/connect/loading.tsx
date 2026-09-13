import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Loading connect" className="px-6 py-0 md:py-8 md:px-12">
      <div className="mx-auto mt-24 max-w-xl space-y-8 text-center">
        <Skeleton className="mx-auto mb-8 h-9 w-72" />

        <div className="flex w-full flex-col items-center gap-2">
          <Skeleton className="h-14 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-16 self-end" />
        </div>

        {/* The two mode buttons - voice and chat. */}
        <div className="mt-4 flex items-center justify-center gap-4 md:gap-8">
          <Skeleton className="size-20 rounded-full md:size-24" />
          <Skeleton className="size-20 rounded-full md:size-24" />
        </div>
      </div>
    </SkeletonPage>
  );
}
