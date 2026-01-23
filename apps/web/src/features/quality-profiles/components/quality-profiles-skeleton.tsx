import { Skeleton } from "@/components/ui/skeleton";

export function QualityProfilesSkeleton() {
  return (
    <>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </>
  );
}
