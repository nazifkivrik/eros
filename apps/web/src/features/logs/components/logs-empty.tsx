"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  message?: string;
};

/**
 * Logs Empty State Component
 * Displayed when no logs match the filters
 */
export function LogsEmpty({ message = "No logs found matching the selected filters." }: Props) {
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
