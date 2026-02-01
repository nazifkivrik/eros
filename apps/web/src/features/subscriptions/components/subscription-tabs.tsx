/**
 * Subscription Tabs Component
 * Displays tabs for filtering by entity type with counts
 * Clean, minimal design
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Film } from "lucide-react";

type TabType = "performers" | "studios" | "scenes";

interface SubscriptionTabsProps {
  subscriptions: SubscriptionDetail[];
  value: TabType;
  onChange: (value: TabType) => void;
  children: (activeTab: TabType) => React.ReactNode;
}

export function SubscriptionTabs({ subscriptions, value, onChange, children }: SubscriptionTabsProps) {
  const performerCount = subscriptions.filter((s) => s.entityType === "performer").length;
  const studioCount = subscriptions.filter((s) => s.entityType === "studio").length;
  const sceneCount = subscriptions.filter((s) => s.entityType === "scene" && s.isSubscribed).length;

  const tabs = [
    { id: "performers" as const, label: "Performers", count: performerCount, icon: Users },
    { id: "studios" as const, label: "Studios", count: studioCount, icon: Building2 },
    { id: "scenes" as const, label: "Scenes", count: sceneCount, icon: Film },
  ];

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as TabType)} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="performers" className="mt-0">
        {children("performers")}
      </TabsContent>

      <TabsContent value="studios" className="mt-0">
        {children("studios")}
      </TabsContent>

      <TabsContent value="scenes" className="mt-0">
        {children("scenes")}
      </TabsContent>
    </Tabs>
  );
}
