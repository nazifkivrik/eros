"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useSearch } from "./hooks/use-search";
import {
  Search,
  Heart,
  Sparkles,
  Film,
  Users,
  Building2,
  X,
  Loader2,
} from "lucide-react";
import { PerformerDetailDialog } from "@/components/dialogs/PerformerDetailDialog";
import { StudioDetailDialog } from "@/components/dialogs/StudioDetailDialog";
import { SceneDetailDialog } from "@/components/dialogs/SceneDetailDialog";
import { SubscribeDialog } from "@/components/dialogs/SubscribeDialog";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { SubscriptionSettings } from "@repo/shared-types";

/**
 * Result card skeleton component
 */
function ResultCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[2/3] w-full" />
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
    </Card>
  );
}

/**
 * Search result card component
 */
function SearchResultCard({
  result,
  onDetailsClick,
  onSubscribeClick,
}: {
  result: any;
  onDetailsClick: (result: any) => void;
  onSubscribeClick: (result: any) => void;
}) {
  const getImageUrl = (item: any): string | null => {
    if (item.poster) return item.poster;
    if (item.thumbnail) return item.thumbnail;
    if (item.images && item.images.length > 0) {
      return item.images[0].url;
    }
    return null;
  };

  const getTypeIcon = () => {
    switch (result.type) {
      case "performer":
        return <Users className="h-3 w-3" />;
      case "studio":
        return <Building2 className="h-3 w-3" />;
      case "scene":
        return <Film className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTypeColor = () => {
    switch (result.type) {
      case "performer":
        return "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30";
      case "studio":
        return "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "scene":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30";
      default:
        return "";
    }
  };

  return (
    <div className="group relative">
      <Card
        className="cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] border-2 hover:border-primary/50"
        onClick={() => onDetailsClick(result)}
      >
        {/* Image */}
        <div className="aspect-[2/3] bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
          {getImageUrl(result) ? (
            <Image
              src={getImageUrl(result)!}
              alt={result.name || result.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
              <Search className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Type badge */}
          <Badge
            className={cn(
              "absolute top-2 left-2 capitalize border backdrop-blur-sm",
              getTypeColor()
            )}
          >
            {getTypeIcon()}
            <span className="ml-1">{result.type}</span>
          </Badge>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Info */}
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold line-clamp-2 text-base group-hover:text-primary transition-colors">
            {result.name || result.title}
          </h3>
          {result.disambiguation && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {result.disambiguation}
            </p>
          )}
          {result.date && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Film className="h-3 w-3" />
              {new Date(result.date).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Subscribe button - shows on hover */}
      <Button
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onSubscribeClick(result);
        }}
        className="absolute top-4 right-4 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:scale-110 hover:bg-pink-500 hover:text-white bg-white"
        title="Subscribe"
      >
        <Heart className="h-4 w-4" />
      </Button>
    </div>
  );
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
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-3xl" />
        <div className="relative p-6 rounded-full bg-gradient-to-br from-muted/50 to-muted">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-semibold mt-6 mb-2">{title}</h3>
      <p className="text-muted-foreground text-center max-w-md">{description}</p>
    </div>
  );
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "performers" | "studios" | "scenes">("all");
  const [page, setPage] = useState(1);
  const limit = 20;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [accumulatedResults, setAccumulatedResults] = useState<{
    performers: any[];
    studios: any[];
    scenes: any[];
  }>({ performers: [], studios: [], scenes: [] });

  const [detailDialogState, setDetailDialogState] = useState<{
    type: "performer" | "studio" | "scene" | null;
    id: string | null;
  }>({ type: null, id: null });

  const [subscribeEntity, setSubscribeEntity] = useState<{
    id: string;
    name?: string;
    title?: string;
    type: "performer" | "studio" | "scene";
  } | null>(null);

  const { data, isLoading, isFetching, error } = useSearch(query, limit, page);

  useEffect(() => {
    setPage(1);
    setAccumulatedResults({ performers: [], studios: [], scenes: [] });
  }, [query]);

  useEffect(() => {
    if (data && !isLoading) {
      setAccumulatedResults((prev) => {
        if (page === 1) {
          return data;
        }

        const newPerformers = data.performers.filter(
          (p: any) => !prev.performers.some((existing: any) => existing.id === p.id)
        );
        const newStudios = data.studios.filter(
          (s: any) => !prev.studios.some((existing: any) => existing.id === s.id)
        );
        const newScenes = data.scenes.filter(
          (s: any) => !prev.scenes.some((existing: any) => existing.id === s.id)
        );

        if (newPerformers.length === 0 && newStudios.length === 0 && newScenes.length === 0) {
          return prev;
        }

        return {
          performers: [...prev.performers, ...newPerformers],
          studios: [...prev.studios, ...newStudios],
          scenes: [...prev.scenes, ...newScenes],
        };
      });
    }
  }, [data, page, isLoading]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !query) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetching && data) {
          const currentPageHasResults =
            data.performers.length > 0 || data.studios.length > 0 || data.scenes.length > 0;

          if (currentPageHasResults) {
            setPage((prev) => prev + 1);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [data, isFetching, query]);

  const tabs = [
    { id: "all" as const, label: "All", count: accumulatedResults.performers.length + accumulatedResults.studios.length + accumulatedResults.scenes.length, icon: Sparkles },
    { id: "performers" as const, label: "Performers", count: accumulatedResults.performers.length, icon: Users },
    { id: "studios" as const, label: "Studios", count: accumulatedResults.studios.length, icon: Building2 },
    { id: "scenes" as const, label: "Scenes", count: accumulatedResults.scenes.length, icon: Film },
  ];

  const getResultsForTab = () => {
    switch (activeTab) {
      case "performers":
        return accumulatedResults.performers.map(p => ({ ...p, type: "performer" }));
      case "studios":
        return accumulatedResults.studios.map(s => ({ ...s, type: "studio" }));
      case "scenes":
        return accumulatedResults.scenes.map(s => ({ ...s, type: "scene" }));
      default:
        return [
          ...accumulatedResults.performers.map(p => ({ ...p, type: "performer" })),
          ...accumulatedResults.studios.map(s => ({ ...s, type: "studio" })),
          ...accumulatedResults.scenes.map(s => ({ ...s, type: "scene" })),
        ];
    }
  };

  const results = getResultsForTab();

  const handleDetailsClick = (result: any) => {
    setDetailDialogState({
      type: result.type,
      id: result.id,
    });
  };

  const handleSubscribeClick = (result: any) => {
    setSubscribeEntity({
      id: result.id,
      name: result.name,
      title: result.title,
      type: result.type,
    });
  };

  const handleSubscribeFromDetail = (entity: any) => {
    setDetailDialogState({ type: null, id: null });
    setSubscribeEntity({
      id: entity.id,
      name: entity.name,
      title: entity.title,
      type: detailDialogState.type!,
    });
  };

  const handleSubscribeConfirm = async (settings: SubscriptionSettings) => {
    if (!subscribeEntity) return;

    try {
      if (subscribeEntity.type === "performer") {
        await apiClient.subscribeToPerformer(subscribeEntity.id, settings);
      } else if (subscribeEntity.type === "studio") {
        await apiClient.subscribeToStudio(subscribeEntity.id, settings);
      } else if (subscribeEntity.type === "scene") {
        await apiClient.subscribeToScene(subscribeEntity.id, settings);
      }

      setSubscribeEntity(null);
      alert(`Successfully subscribed to ${subscribeEntity.name || subscribeEntity.title}`);
    } catch (error) {
      console.error("Subscription error:", error);
      alert(`Failed to subscribe: ${(error as Error).message}`);
    }
  };

  const clearSearch = () => {
    setQuery("");
  };

  return (
    <div className="space-y-8">
      {/* Header with gradient */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Search
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover performers, studios, and scenes
          </p>
        </div>
      </div>

      {/* Search Bar with glow effect */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-xl blur-xl opacity-0 peer-focus-within:opacity-100 transition-opacity" />
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search for performers, studios, and scenes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-10 h-12 text-base border-2 focus:border-primary/50 focus:ring-0 transition-colors"
          />
          {query && (
            <Button
              size="icon"
              variant="ghost"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs with icons and badges */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4 h-12 bg-muted/50 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Icon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{tab.label}</span>
                {query && tab.count > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="space-y-6">
        {/* Loading state - initial */}
        {isLoading && page === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <ResultCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <EmptyState
            icon={<Search className="h-16 w-16 text-destructive/50" />}
            title="Search Error"
            description={`Failed to load results: ${(error as Error).message}`}
          />
        )}

        {/* Empty state - no query */}
        {!isLoading && !error && !query && (
          <EmptyState
            icon={
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-full blur-2xl animate-pulse" />
                <Sparkles className="relative h-20 w-20 text-primary" />
              </div>
            }
            title="Start Exploring"
            description="Search for your favorite performers, studios, or scenes to begin discovering content."
          />
        )}

        {/* Empty state - no results */}
        {!isLoading && !error && query && results.length === 0 && (
          <EmptyState
            icon={<Search className="h-16 w-16 text-muted-foreground/30" />}
            title="No Results Found"
            description={`We couldn't find any results for "${query}". Try different keywords or check your spelling.`}
          />
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {results.map((result: any) => (
                <SearchResultCard
                  key={`${result.type}-${result.id}`}
                  result={result}
                  onDetailsClick={handleDetailsClick}
                  onSubscribeClick={handleSubscribeClick}
                />
              ))}
            </div>

            {/* Loading more indicator */}
            <div
              ref={loadMoreRef}
              className="h-20 flex items-center justify-center"
            >
              {isFetching && page > 1 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading more results...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail Dialogs */}
      <PerformerDetailDialog
        performerId={detailDialogState.type === "performer" ? detailDialogState.id : null}
        onClose={() => setDetailDialogState({ type: null, id: null })}
        onSubscribe={handleSubscribeFromDetail}
      />

      <StudioDetailDialog
        studioId={detailDialogState.type === "studio" ? detailDialogState.id : null}
        onClose={() => setDetailDialogState({ type: null, id: null })}
        onSubscribe={handleSubscribeFromDetail}
      />

      <SceneDetailDialog
        sceneId={detailDialogState.type === "scene" ? detailDialogState.id : null}
        onClose={() => setDetailDialogState({ type: null, id: null })}
        onSubscribe={handleSubscribeFromDetail}
      />

      {/* Subscribe Dialog */}
      <SubscribeDialog
        entity={subscribeEntity}
        onClose={() => setSubscribeEntity(null)}
        onConfirm={handleSubscribeConfirm}
      />
    </div>
  );
}
