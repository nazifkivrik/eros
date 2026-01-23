"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Logs Skeleton Component
 * Loading state for logs list
 */
export function LogsSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
