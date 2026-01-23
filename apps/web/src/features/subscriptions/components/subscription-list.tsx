/**
 * Subscription List Component
 * Wrapper component that renders the appropriate view (card or table) for subscriptions
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

// Cards
import { PerformerCard } from "./cards/performer-card";
import { StudioCard } from "./cards/studio-card";
import { SceneCard } from "./cards/scene-card";

// Tables
import { PerformerTable } from "./tables/performer-table";
import { StudioTable } from "./tables/studio-table";
import { SceneTable } from "./tables/scene-table";

type TabType = "performers" | "studios" | "scenes";

interface SubscriptionListProps {
  activeTab: TabType;
  performers: SubscriptionDetail[];
  studios: SubscriptionDetail[];
  scenes: SubscriptionDetail[];
  viewMode: "card" | "table";
  isLoading: boolean;
  hasFilters: boolean;
  onDelete: (subscription: SubscriptionDetail, e: React.MouseEvent) => void;
  onToggleSubscribe: (subscription: SubscriptionDetail, e: React.MouseEvent) => void;
  isDeletePending?: boolean;
}

export function SubscriptionList({
  activeTab,
  performers,
  studios,
  scenes,
  viewMode,
  isLoading,
  hasFilters,
  onDelete,
  onToggleSubscribe,
  isDeletePending,
}: SubscriptionListProps) {
  const renderEmptyState = (entityType: string) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <p>
            {hasFilters
              ? `No ${entityType} subscriptions match your filters.`
              : entityType === "performers"
              ? "No performer subscriptions yet. Search and subscribe to performers to start tracking their content."
              : entityType === "studios"
              ? "No studio subscriptions yet. Search and subscribe to studios to start tracking their content."
              : "No scene subscriptions yet. Scene subscriptions are automatically created when you subscribe to performers or studios."}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderLoadingState = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Render content based on active tab
  if (activeTab === "performers") {
    if (isLoading) {
      return renderLoadingState();
    }
    if (performers.length === 0) {
      return renderEmptyState("performers");
    }
    return viewMode === "table" ? (
      <PerformerTable subscriptions={performers} onDelete={onDelete} isDeletePending={isDeletePending} />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {performers.map((sub) => (
          <PerformerCard key={sub.id} subscription={sub} onDelete={onDelete} isDeletePending={isDeletePending} />
        ))}
      </div>
    );
  }

  if (activeTab === "studios") {
    if (isLoading) {
      return renderLoadingState();
    }
    if (studios.length === 0) {
      return renderEmptyState("studios");
    }
    return viewMode === "table" ? (
      <StudioTable subscriptions={studios} onDelete={onDelete} isDeletePending={isDeletePending} />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {studios.map((sub) => (
          <StudioCard key={sub.id} subscription={sub} onDelete={onDelete} isDeletePending={isDeletePending} />
        ))}
      </div>
    );
  }

  // scenes tab
  if (isLoading) {
    return renderLoadingState();
  }
  if (scenes.length === 0) {
    return renderEmptyState("scenes");
  }
  return viewMode === "table" ? (
    <SceneTable subscriptions={scenes} onToggleSubscribe={onToggleSubscribe} />
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {scenes.map((sub) => (
        <SceneCard key={sub.id} subscription={sub} onToggleSubscribe={onToggleSubscribe} />
      ))}
    </div>
  );
}
