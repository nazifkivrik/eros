"use client";

import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  isConnected: boolean;
};

/**
 * Jobs Header Component
 * Displays page title and connection status
 */
export function JobsHeader({ isConnected }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Background Jobs</h1>
          <p className="text-muted-foreground">
            Monitor and manually trigger scheduled background tasks
          </p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
          <Activity className="h-3 w-3" />
          {isConnected ? "Live Updates Active" : "Connecting..."}
        </Badge>
      </div>
    </div>
  );
}
