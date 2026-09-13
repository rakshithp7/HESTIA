import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonPage
      label="Loading verification"
      className="flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-xl space-y-6 p-8 text-center">
        <Skeleton className="mx-auto h-8 w-64" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/5" />
        </div>
        <Skeleton className="mx-auto h-10 w-40 rounded-md" />
      </div>
    </SkeletonPage>
  );
}
