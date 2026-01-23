/**
 * Subscription Stats Component
 * Displays statistics cards for performer, studio, and scene subscriptions
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Users, Building2, Film } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SubscriptionStatsProps {
  subscriptions: SubscriptionDetail[];
}

export function SubscriptionStats({ subscriptions }: SubscriptionStatsProps) {
  const performerCount = subscriptions.filter((s) => s.entityType === "performer").length;
  const studioCount = subscriptions.filter((s) => s.entityType === "studio").length;
  const sceneCount = subscriptions.filter((s) => s.entityType === "scene").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">{performerCount}</CardTitle>
          </div>
          <CardDescription>Performer Subscriptions</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">{studioCount}</CardTitle>
          </div>
          <CardDescription>Studio Subscriptions</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">{sceneCount}</CardTitle>
          </div>
          <CardDescription>Scene Subscriptions</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
