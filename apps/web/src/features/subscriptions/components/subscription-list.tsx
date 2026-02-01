/**
 * Subscription List Component
 * Wrapper component that renders the appropriate view (card or table) for subscriptions
 * Modern UI with enhanced empty states and loading indicators
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, Film, Search } from "lucide-react";

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

/**
 * Empty state component
 */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 rounded-full bg-muted mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
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
  const getEmptyState = (entityType: TabType) => {
    if (hasFilters) {
      return {
        icon: <Search className="h-12 w-12 text-muted-foreground/50" />,
        title: "No Results Found",
        description: `No ${entityType} match your current filters. Try adjusting your search or filter settings.`,
      };
    }

    const messages = {
      performers: {
        icon: <Users className="h-12 w-12 text-purple-500/50" />,
        title: "No Performer Subscriptions",
        description: "Search and subscribe to performers to start tracking their content. You can find performers in the search page.",
      },
      studios: {
        icon: <Building2 className="h-12 w-12 text-blue-500/50" />,
        title: "No Studio Subscriptions",
        description: "Search and subscribe to studios to start tracking their content. You can find studios in the search page.",
      },
      scenes: {
        icon: <Film className="h-12 w-12 text-orange-500/50" />,
        title: "No Scene Subscriptions",
        description: "Scene subscriptions are automatically created when you subscribe to performers or studios. Check back after subscribing!",
      },
    };

    return messages[entityType];
  };

  const renderLoadingState = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-[2/3] w-full" />
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Render content based on active tab
  if (activeTab === "performers") {
    if (isLoading) {
      return renderLoadingState();
    }
    if (performers.length === 0) {
      const { icon, title, description } = getEmptyState("performers");
      return <EmptyState icon={icon} title={title} description={description} />;
    }
    return viewMode === "table" ? (
      <PerformerTable subscriptions={performers} onDelete={onDelete} isDeletePending={isDeletePending} />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
      const { icon, title, description } = getEmptyState("studios");
      return <EmptyState icon={icon} title={title} description={description} />;
    }
    return viewMode === "table" ? (
      <StudioTable subscriptions={studios} onDelete={onDelete} isDeletePending={isDeletePending} />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
    const { icon, title, description } = getEmptyState("scenes");
    return <EmptyState icon={icon} title={title} description={description} />;
  }
  return viewMode === "table" ? (
    <SceneTable subscriptions={scenes} onToggleSubscribe={onToggleSubscribe} />
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {scenes.map((sub) => (
        <SceneCard key={sub.id} subscription={sub} onToggleSubscribe={onToggleSubscribe} />
      ))}
    </div>
  );
}
