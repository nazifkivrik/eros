"use client";

import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  isConnected: boolean;
};

/**
 * Jobs Header Component
 * Displays page title and connection status
 * With gradient styling
 */
export function JobsHeader({ isConnected }: Props) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Jobs
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage background tasks
            </p>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
            <Activity className="h-3 w-3" />
            {isConnected ? "Live" : "Connecting..."}
          </Badge>
        </div>
      </div>
    </div>
  );
}
