/**
 * Subscription Stats Component
 * Displays statistics cards for performer, studio, and scene subscriptions
 * Clean, minimal design
 */

"use client";

import type { SubscriptionDetail } from "@repo/shared-types";
import { Users, Building2, Film } from "lucide-react";
import { Card } from "@/components/ui/card";

interface SubscriptionStatsProps {
  subscriptions: SubscriptionDetail[];
}

export function SubscriptionStats({ subscriptions }: SubscriptionStatsProps) {
  const performerCount = subscriptions.filter((s) => s.entityType === "performer").length;
  const studioCount = subscriptions.filter((s) => s.entityType === "studio").length;
  const sceneCount = subscriptions.filter((s) => s.entityType === "scene").length;

  const stats = [
    {
      title: "Performers",
      value: performerCount,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Studios",
      value: studioCount,
      icon: Building2,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Scenes",
      value: sceneCount,
      icon: Film,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.title}
            className="p-4 border-2 hover:border-border/80 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
