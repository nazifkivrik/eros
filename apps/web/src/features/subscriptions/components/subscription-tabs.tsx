/**
 * Subscription Tabs Component
 * Displays tabs for filtering by entity type with counts
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as TabType)}>
      <TabsList>
        <TabsTrigger value="performers">
          Performers ({performerCount})
        </TabsTrigger>
        <TabsTrigger value="studios">
          Studios ({studioCount})
        </TabsTrigger>
        <TabsTrigger value="scenes">
          Scenes ({sceneCount})
        </TabsTrigger>
      </TabsList>

      {/* Render children wrapped in appropriate TabsContent */}
      <TabsContent value="performers" className="mt-6">
        {children("performers")}
      </TabsContent>

      <TabsContent value="studios" className="mt-6">
        {children("studios")}
      </TabsContent>

      <TabsContent value="scenes" className="mt-6">
        {children("scenes")}
      </TabsContent>
    </Tabs>
  );
}
