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
 * With gradient styling
 */
export function LogsHeader({ onCleanup, isPending }: Props) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor application events
            </p>
          </div>
          <Button variant="outline" onClick={onCleanup} disabled={isPending}>
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>
    </div>
  );
}
