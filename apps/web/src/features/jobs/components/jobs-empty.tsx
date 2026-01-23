"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  message?: string;
};

/**
 * Jobs Empty State Component
 * Displayed when no jobs are configured
 */
export function JobsEmpty({
  message = "No jobs configured. Jobs will appear here once they are registered."
}: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 text-muted-foreground justify-center py-8">
          <AlertCircle className="h-5 w-5" />
          <p>{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
