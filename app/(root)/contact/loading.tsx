import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage label="Loading contact" className="px-6 py-8 md:px-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-3/4" />

        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}

        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>

        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </SkeletonPage>
  );
}
