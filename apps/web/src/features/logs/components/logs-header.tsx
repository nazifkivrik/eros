"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCleanup: () => void;
  isPending: boolean;
};

/**
 * Logs Header Component
 * Displays the page title and cleanup button
 */
export function LogsHeader({ onCleanup, isPending }: Props) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-4xl font-bold mb-2">Logs</h1>
        <p className="text-muted-foreground">
          Monitor application events and troubleshoot issues
        </p>
      </div>
      <Button variant="outline" onClick={onCleanup} disabled={isPending}>
        <Trash2 className="h-4 w-4 mr-2" />
        Cleanup Old Logs
      </Button>
    </div>
  );
}
