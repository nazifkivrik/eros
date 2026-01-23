"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Jobs Skeleton Component
 * Loading state for jobs list
 */
export function JobsSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
