/**
 * Subscriptions View
 * Main orchestration component for the subscriptions feature
 * Clean, minimal design
 */

"use client";

import { useMemo, useState, Suspense } from "react";
import type { SubscriptionDetail } from "@repo/shared-types";
import { useSubscriptions, useDeleteSubscription } from "@/features/subscriptions";
import { apiClient } from "@/lib/api-client";
import { UnsubscribeConfirmDialog } from "@/components/dialogs/UnsubscribeConfirmDialog";
import { ViewToggle } from "@/components/subscriptions/ViewToggle";
import { SubscriptionFilters } from "@/components/subscriptions/SubscriptionFilters";
import { useSubscriptionFilters } from "@/features/subscriptions";

// New feature-based components
import {
  SubscriptionStats,
  SubscriptionTabs,
  SubscriptionList,
} from "./components";

function SubscriptionsContent() {
  // URL-based filter state
  const {
    filters,
    setView,
    setSearch,
    setTab,
    setIncludeMetaless,
    setShowInactive,
    toggleTag,
    clearAllFilters,
  } = useSubscriptionFilters({ defaultView: "table", defaultTab: "performers" });

  // Data fetching
  const { data: subscriptions, isLoading } = useSubscriptions({
    search: filters.search || undefined,
    includeMetaless: filters.includeMetaless,
  });

  const deleteSubscription = useDeleteSubscription();

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    subscription: SubscriptionDetail | null;
  }>({ open: false, subscription: null });

  // Get all unique tags from scenes
  const availableTags = useMemo(() => {
    const scenes = subscriptions?.data?.filter((s) => s.entityType === "scene") || [];
    const tagSet = new Set<string>();
    scenes.forEach((sub) => {
      const scene = sub.entity as any;
      if (scene?.tags) {
        scene.tags.forEach((tag: any) => tagSet.add(tag.name));
      }
    });
    return Array.from(tagSet).sort();
  }, [subscriptions]);

  // Filter subscriptions based on URL state
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions?.data || [];

    // Tab filtering (client-side)
    if (filters.tab) {
      const entityTypeMap: Record<string, string> = {
        performers: "performer",
        studios: "studio",
        scenes: "scene",
      };
      filtered = filtered.filter((s) => s.entityType === entityTypeMap[filters.tab!]);
    }

    // Tag filtering (for scenes only, client-side)
    if (filters.tab === "scenes" && filters.tags.length > 0) {
      filtered = filtered.filter((s) => {
        const scene = s.entity as any;
        const sceneTags = scene?.tags?.map((t: any) => t.name) || [];
        return filters.tags!.some((tag) => sceneTags.includes(tag));
      });
    }

    // Show unsubscribed filtering (client-side)
    if (!filters.showInactive) {
      filtered = filtered.filter((s) => s.isSubscribed === true);
    }

    return filtered;
  }, [subscriptions, filters]);

  const performers = filteredSubscriptions.filter((s) => s.entityType === "performer");
  const studios = filteredSubscriptions.filter((s) => s.entityType === "studio");
  const scenes = filteredSubscriptions.filter((s) => s.entityType === "scene");

  const handleUnsubscribeClick = (subscription: SubscriptionDetail, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Scene subscriptions: toggle isSubscribed (unsubscribe/resubscribe)
    if (subscription.entityType === "scene") {
      apiClient.updateSubscription(subscription.id, {
        isSubscribed: !subscription.isSubscribed
      }).then(() => {
        window.location.reload();
      }).catch((err) => {
        console.error('Failed to update subscription:', err);
      });
      return;
    }

    // Performer/Studio subscriptions: show dialog to ask about associated scenes
    setDeleteDialog({ open: true, subscription });
  };

  const handleConfirmDelete = (deleteAssociatedScenes: boolean) => {
    if (deleteDialog.subscription) {
      deleteSubscription.mutate({
        id: deleteDialog.subscription.id,
        deleteAssociatedScenes,
        removeFiles: deleteAssociatedScenes, // Always delete files when deleting scenes
      });
      setDeleteDialog({ open: false, subscription: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - clean and simple */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage your performer, studio, and scene subscriptions
          </p>
        </div>
        <ViewToggle view={filters.view} onViewChange={setView} />
      </div>

      {/* Stats - clean cards */}
      <SubscriptionStats subscriptions={subscriptions?.data || []} />

      {/* Filters */}
      <SubscriptionFilters
        tab={filters.tab}
        search={filters.search}
        onSearchChange={setSearch}
        includeMetaless={filters.includeMetaless}
        onMetalessChange={setIncludeMetaless}
        showInactive={filters.showInactive}
        onInactiveChange={setShowInactive}
        selectedTags={filters.tags}
        onTagToggle={toggleTag}
        onClearTags={clearAllFilters}
        availableTags={availableTags}
        showTagFilter={filters.tab === "scenes"}
      />

      {/* Tabs with content */}
      <SubscriptionTabs
        subscriptions={subscriptions?.data || []}
        value={filters.tab || "performers"}
        onChange={setTab}
      >
        {(activeTab) => (
          <SubscriptionList
            activeTab={activeTab}
            performers={performers}
            studios={studios}
            scenes={scenes}
            viewMode={filters.view}
            isLoading={isLoading}
            hasFilters={!!(filters.search || filters.tags.length > 0)}
            onDelete={handleUnsubscribeClick}
            onToggleSubscribe={handleUnsubscribeClick}
            isDeletePending={deleteSubscription.isPending}
          />
        )}
      </SubscriptionTabs>

      {/* Delete Confirmation Dialog */}
      <UnsubscribeConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, subscription: null })}
        entityType={deleteDialog.subscription?.entityType || "performer"}
        entityName={deleteDialog.subscription?.entityName || "Unknown"}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/**
 * SubscriptionsView Component
 * Main entry point for the subscriptions feature
 */
export function SubscriptionsView() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading subscriptions...</p>
        </div>
      </div>
    }>
      <SubscriptionsContent />
    </Suspense>
  );
}
