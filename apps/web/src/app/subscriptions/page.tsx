"use client";

import { useMemo, useState, Suspense } from "react";
import type { SubscriptionDetail } from "@repo/shared-types";
import Link from "next/link";
import { Users, Building2, Film, Trash2, AlertCircle, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSubscriptions, useDeleteSubscription } from "@/hooks/useSubscriptions";
import { apiClient } from "@/lib/api-client";
import { UnsubscribeConfirmDialog } from "@/components/dialogs/UnsubscribeConfirmDialog";
import { ViewToggle } from "@/components/subscriptions/ViewToggle";
import { SubscriptionImage } from "@/components/subscriptions/SubscriptionImage";
import { SubscriptionFilters } from "@/components/subscriptions/SubscriptionFilters";
import { useSubscriptionFilters } from "@/hooks/useSubscriptionFilters";
import { cn } from "@/lib/utils";

function SubscriptionsContent() {
  // URL-based filter state - call this first to get filters
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

  // Call useSubscriptions with filters (showInactive is filtered client-side)
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
  // Note: search, includeMetaless are filtered server-side
  // Tab, tags, and showInactive are filtered client-side
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions?.data || [];

    // Tab filtering (client-side)
    if (filters.tab) {
      // Convert tab name (plural) to entity type (singular)
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
    // Checkbox unchecked (false): show only isSubscribed === true
    // Checkbox checked (true): show all
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
    // DO NOT delete - scene subscriptions should remain in DB for resubscribe capability
    if (subscription.entityType === "scene") {
      apiClient.updateSubscription(subscription.id, {
        isSubscribed: !subscription.isSubscribed
      }).then(() => {
        // Refetch subscriptions to show updated state
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
      });
      setDeleteDialog({ open: false, subscription: null });
    }
  };

  // Helper to get the best image URL from entity data
  const getEntityImageUrl = (entity: any, entityType?: string): string | null => {
    if (!entity) return null;

    const isScene = entityType === "scene";

    // === SCENES: Prefer background (landscape) ===
    if (isScene) {
      // background object has full/large/medium/small sizes
      if (entity.background) {
        if (typeof entity.background === "object") {
          return entity.background.full || entity.background.large || Object.values(entity.background)[0];
        }
        return entity.background;
      }
      // Fallback to background_back
      if (entity.background_back) {
        if (typeof entity.background_back === "object") {
          return entity.background_back.full || entity.background_back.large || Object.values(entity.background_back)[0];
        }
        return entity.background_back;
      }
      // Fallback to image (horizontal/landscape)
      if (entity.image) return entity.image;
      // Fallback to back_image
      if (entity.back_image) return entity.back_image;
    }

    // === ALL TYPES: Check images array for background (scenes) or poster (performers/studios) ===
    const images =
      entity.images
        ? typeof entity.images === "string"
          ? JSON.parse(entity.images)
          : entity.images
        : [];

    if (images.length > 0) {
      // For scenes, prefer background-type images
      if (isScene) {
        const backgroundImg = images.find((img: any) =>
          img.url?.includes("/background/") || img.type === "background"
        );
        if (backgroundImg) return backgroundImg.url;
      }
      // First image
      if (images[0]?.url) return images[0].url;
    }

    // === FALLBACKS ===
    // For scenes, poster is last resort (portrait)
    if (isScene && entity.poster) return entity.poster;

    // For performers/studios, prefer poster/thumbnail/logo
    if (!isScene) {
      if (entity.poster) return entity.poster;
      if (entity.thumbnail) return entity.thumbnail;
      if (entity.logo) return entity.logo;
    }

    return null;
  };

  const renderPerformersTable = () => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Quality Profile</TableHead>
            <TableHead>Auto Download</TableHead>
            <TableHead>Include Aliases</TableHead>
            <TableHead>Subscribed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {performers.map((sub) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => (window.location.href = `/subscriptions/${sub.id}`)}
            >
              <TableCell className="font-medium">{sub.entityName}</TableCell>
              <TableCell>{sub.qualityProfile?.name || "N/A"}</TableCell>
              <TableCell>
                <Badge variant={sub.autoDownload ? "default" : "outline"}>
                  {sub.autoDownload ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={sub.includeAliases ? "default" : "outline"}>
                  {sub.includeAliases ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleUnsubscribeClick(sub, e)}
                    disabled={deleteSubscription.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderPerformersCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {performers.map((sub) => (
        <Link key={sub.id} href={`/subscriptions/${sub.id}`}>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden">
            <SubscriptionImage
              src={getEntityImageUrl(sub.entity, sub.entityType)}
              alt={sub.entityName}
              type="performer"
            />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate text-base">{sub.entityName}</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {sub.qualityProfile?.name || "No quality profile"}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  disabled={deleteSubscription.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex gap-1 flex-wrap text-xs">
                <Badge
                  variant={sub.autoDownload ? "default" : "outline"}
                  className="text-xs"
                >
                  Auto: {sub.autoDownload ? "On" : "Off"}
                </Badge>
                <Badge
                  variant={sub.includeAliases ? "default" : "outline"}
                  className="text-xs"
                >
                  Aliases
                </Badge>
                {sub.includeMetadataMissing && (
                  <Badge variant="secondary" className="text-xs">
                    No Metadata
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(sub.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );

  const renderStudiosTable = () => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Quality Profile</TableHead>
            <TableHead>Auto Download</TableHead>
            <TableHead>Include Aliases</TableHead>
            <TableHead>Subscribed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {studios.map((sub) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => (window.location.href = `/subscriptions/${sub.id}`)}
            >
              <TableCell className="font-medium">{sub.entityName}</TableCell>
              <TableCell>{sub.qualityProfile?.name || "N/A"}</TableCell>
              <TableCell>
                <Badge variant={sub.autoDownload ? "default" : "outline"}>
                  {sub.autoDownload ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={sub.includeAliases ? "default" : "outline"}>
                  {sub.includeAliases ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  disabled={deleteSubscription.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderStudiosCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {studios.map((sub) => (
        <Link key={sub.id} href={`/subscriptions/${sub.id}`}>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden">
            <SubscriptionImage
              src={getEntityImageUrl(sub.entity, sub.entityType)}
              alt={sub.entityName}
              type="studio"
            />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate text-base">{sub.entityName}</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {sub.qualityProfile?.name || "No quality profile"}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  disabled={deleteSubscription.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex gap-1 flex-wrap text-xs">
                <Badge
                  variant={sub.autoDownload ? "default" : "outline"}
                  className="text-xs"
                >
                  Auto: {sub.autoDownload ? "On" : "Off"}
                </Badge>
                <Badge
                  variant={sub.includeAliases ? "default" : "outline"}
                  className="text-xs"
                >
                  Aliases
                </Badge>
                {sub.includeMetadataMissing && (
                  <Badge variant="secondary" className="text-xs">
                    No Metadata
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(sub.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );

  const renderScenesTable = () => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Quality Profile</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenes.map((sub) => (
            <TableRow
              key={sub.id}
              className={cn(
                "cursor-pointer hover:bg-accent/50",
                !sub.isSubscribed && "opacity-60 bg-muted/30"
              )}
              onClick={() => (window.location.href = `/subscriptions/${sub.id}`)}
            >
              <TableCell className="font-medium">{sub.entityName}</TableCell>
              <TableCell>{sub.qualityProfile?.name || "N/A"}</TableCell>
              <TableCell>
                <Badge
                  variant={sub.isSubscribed ? "default" : "secondary"}
                  className={cn(
                    sub.isSubscribed ? "bg-green-600" : "bg-muted text-muted-foreground"
                  )}
                >
                  {sub.isSubscribed ? "✓ Active" : "○ Inactive"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant={sub.isSubscribed ? "ghost" : "default"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  title={sub.isSubscribed ? "Unsubscribe" : "Resubscribe"}
                >
                  {sub.isSubscribed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderScenesCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {scenes.map((sub) => (
        <Link key={sub.id} href={`/subscriptions/${sub.id}`}>
          <Card
            className={cn(
              "cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden",
              !sub.isSubscribed && "opacity-60 grayscale-[50%]"
            )}
          >
            <SubscriptionImage
              src={getEntityImageUrl(sub.entity, sub.entityType)}
              alt={sub.entityName}
              type="scene"
            />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate text-sm">{sub.entityName}</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {sub.qualityProfile?.name || "No quality profile"}
                  </CardDescription>
                </div>
                <Button
                  variant={sub.isSubscribed ? "ghost" : "default"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  title={sub.isSubscribed ? "Unsubscribe" : "Resubscribe"}
                >
                  {sub.isSubscribed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex gap-1 flex-wrap text-xs">
                <Badge
                  variant={sub.isSubscribed ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    sub.isSubscribed ? "bg-green-600" : "bg-muted text-muted-foreground"
                  )}
                >
                  {sub.isSubscribed ? "✓ Active" : "○ Inactive"}
                </Badge>
                <Badge
                  variant={sub.autoDownload ? "default" : "outline"}
                  className="text-xs"
                >
                  Auto: {sub.autoDownload ? "On" : "Off"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(sub.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage your performer, studio, and scene subscriptions
          </p>
        </div>

        {/* View Toggle */}
        <ViewToggle view={filters.view} onViewChange={setView} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-bold">
                {subscriptions?.data?.filter((s) => s.entityType === "performer").length || 0}
              </CardTitle>
            </div>
            <CardDescription>Performer Subscriptions</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-bold">
                {subscriptions?.data?.filter((s) => s.entityType === "studio").length || 0}
              </CardTitle>
            </div>
            <CardDescription>Studio Subscriptions</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-bold">
                {subscriptions?.data?.filter((s) => s.entityType === "scene").length || 0}
              </CardTitle>
            </div>
            <CardDescription>Scene Subscriptions</CardDescription>
          </CardHeader>
        </Card>
      </div>

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

      {/* Tabs */}
      <Tabs value={filters.tab} onValueChange={(tab) => setTab(tab as any)}>
        <TabsList>
          <TabsTrigger value="performers">
            Performers (
            {subscriptions?.data?.filter((s) => s.entityType === "performer").length || 0}
            )
          </TabsTrigger>
          <TabsTrigger value="studios">
            Studios (
            {subscriptions?.data?.filter((s) => s.entityType === "studio").length || 0}
            )
          </TabsTrigger>
          <TabsTrigger value="scenes">
            Scenes (
            {subscriptions?.data?.filter((s) => s.entityType === "scene" && s.isSubscribed).length || 0}
            )
          </TabsTrigger>
        </TabsList>

        {/* Performers Tab */}
        <TabsContent value="performers" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : performers.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <p>
                    {filters.search || filters.tags.length > 0
                      ? "No performer subscriptions match your filters."
                      : "No performer subscriptions yet. Search and subscribe to performers to start tracking their content."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : filters.view === "table" ? (
            renderPerformersTable()
          ) : (
            renderPerformersCards()
          )}
        </TabsContent>

        {/* Studios Tab */}
        <TabsContent value="studios" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : studios.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <p>
                    {filters.search || filters.tags.length > 0
                      ? "No studio subscriptions match your filters."
                      : "No studio subscriptions yet. Search and subscribe to studios to start tracking their content."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : filters.view === "table" ? (
            renderStudiosTable()
          ) : (
            renderStudiosCards()
          )}
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : scenes.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <p>
                    {filters.search || filters.tags.length > 0 || !filters.includeMetaless
                      ? "No scene subscriptions match your filters."
                      : "No scene subscriptions yet. Scene subscriptions are automatically created when you subscribe to performers or studios."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : filters.view === "table" ? (
            renderScenesTable()
          ) : (
            renderScenesCards()
          )}
        </TabsContent>
      </Tabs>

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

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <SubscriptionsContent />
    </Suspense>
  );
}
