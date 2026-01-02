"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useSearch } from "@/hooks/useSearch";
import { Search, Heart } from "lucide-react";
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

import type { SubscriptionSettings } from "@repo/shared-types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "performers" | "studios" | "scenes">("all");
  const [page, setPage] = useState(1);
  const limit = 20; // Fixed limit per page
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Accumulated results for infinite scroll
  const [accumulatedResults, setAccumulatedResults] = useState<{
    performers: any[];
    studios: any[];
    scenes: any[];
  }>({ performers: [], studios: [], scenes: [] });

  // Dialog state
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

  // Reset page and accumulated results when query changes
  useEffect(() => {
    setPage(1);
    setAccumulatedResults({ performers: [], studios: [], scenes: [] });
  }, [query]);

  // Append new results to accumulated results
  useEffect(() => {
    if (data && !isLoading) {
      setAccumulatedResults((prev) => {
        // If page is 1, replace results (new search)
        if (page === 1) {
          return data;
        }

        // Deduplicate by ID to prevent duplicates
        const newPerformers = data.performers.filter(
          (p: any) => !prev.performers.some((existing: any) => existing.id === p.id)
        );
        const newStudios = data.studios.filter(
          (s: any) => !prev.studios.some((existing: any) => existing.id === s.id)
        );
        const newScenes = data.scenes.filter(
          (s: any) => !prev.scenes.some((existing: any) => existing.id === s.id)
        );

        // Only append if we have new results
        if (newPerformers.length === 0 && newStudios.length === 0 && newScenes.length === 0) {
          console.log('[Infinite Scroll] No new unique results to append');
          return prev;
        }

        console.log('[Infinite Scroll] Appending new results:', {
          newPerformers: newPerformers.length,
          newStudios: newStudios.length,
          newScenes: newScenes.length
        });

        // Otherwise append new unique results
        return {
          performers: [...prev.performers, ...newPerformers],
          studios: [...prev.studios, ...newStudios],
          scenes: [...prev.scenes, ...newScenes],
        };
      });
    }
  }, [data, page, isLoading]);

  // Infinite scroll logic
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !query) {
      console.log('[Infinite Scroll] Observer not set up:', { hasElement: !!element, query });
      return;
    }

    console.log('[Infinite Scroll] Setting up observer', { page, isFetching });

    const observer = new IntersectionObserver(
      (entries) => {
        console.log('[Infinite Scroll] Intersection detected:', {
          isIntersecting: entries[0].isIntersecting,
          isFetching,
          hasData: !!data,
          page
        });

        // Only trigger load more if:
        // 1. Element is intersecting (visible)
        // 2. Not currently fetching
        // 3. There is data from current page
        if (entries[0].isIntersecting && !isFetching && data) {
          const currentPageHasResults =
            data.performers.length > 0 || data.studios.length > 0 || data.scenes.length > 0;

          console.log('[Infinite Scroll] Check results:', {
            currentPageHasResults,
            performers: data.performers.length,
            studios: data.studios.length,
            scenes: data.scenes.length
          });

          if (currentPageHasResults) {
            console.log('[Infinite Scroll] Loading next page:', page + 1);
            setPage((prev) => prev + 1);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      console.log('[Infinite Scroll] Disconnecting observer');
      observer.disconnect();
    };
  }, [data, isFetching, query]);

  const tabs = [
    { id: "all" as const, label: "All", count: accumulatedResults.performers.length + accumulatedResults.studios.length + accumulatedResults.scenes.length },
    { id: "performers" as const, label: "Performers", count: accumulatedResults.performers.length },
    { id: "studios" as const, label: "Studios", count: accumulatedResults.studios.length },
    { id: "scenes" as const, label: "Scenes", count: accumulatedResults.scenes.length },
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

  // Helper to get the best image URL from TPDB data
  const getImageUrl = (result: any): string | null => {
    // For performers and scenes, prefer poster/thumbnail from TPDB
    if (result.poster) return result.poster;
    if (result.thumbnail) return result.thumbnail;

    // Fallback to images array
    if (result.images && result.images.length > 0) {
      return result.images[0].url;
    }

    return null;
  };

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
    // Close detail dialog
    setDetailDialogState({ type: null, id: null });

    // Open subscribe dialog
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
      // Make API call based on entity type
      if (subscribeEntity.type === "performer") {
        await apiClient.subscribeToPerformer(subscribeEntity.id, settings);
      } else if (subscribeEntity.type === "studio") {
        await apiClient.subscribeToStudio(subscribeEntity.id, settings);
      } else if (subscribeEntity.type === "scene") {
        await apiClient.subscribeToScene(subscribeEntity.id, settings);
      }

      // Close dialog
      setSubscribeEntity(null);

      // Show success message (you can add a toast notification here)
      alert(`Successfully subscribed to ${subscribeEntity.name || subscribeEntity.title}`);
    } catch (error) {
      console.error("Subscription error:", error);
      alert(`Failed to subscribe: ${(error as Error).message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Search</h1>
        <p className="text-muted-foreground">
          Search for performers, studios, and scenes
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search for performers, studios, and scenes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-4">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {query && tab.count > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-muted-foreground">Searching...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-destructive">Error: {(error as Error).message}</p>
            </div>
          )}

          {!isLoading && !error && query && results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No results found</p>
            </div>
          )}

          {!query && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Enter a search query to get started
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {results.map((result: any) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="group relative"
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                    onClick={() => handleDetailsClick(result)}
                  >
                    {/* Image */}
                    <div className="aspect-[2/3] bg-accent relative overflow-hidden">
                      {getImageUrl(result) ? (
                        <Image
                          src={getImageUrl(result)!}
                          alt={result.name || result.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Search className="h-12 w-12" />
                        </div>
                      )}

                      {/* Type badge */}
                      <Badge
                        className="absolute top-2 left-2 capitalize"
                        variant="secondary"
                      >
                        {result.type}
                      </Badge>
                    </div>

                    {/* Info */}
                    <CardContent className="p-3">
                      <h3 className="font-medium line-clamp-2 mb-1 text-sm">
                        {result.name || result.title}
                      </h3>
                      {result.disambiguation && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {result.disambiguation}
                        </p>
                      )}
                      {result.date && (
                        <p className="text-xs text-muted-foreground">
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
                      handleSubscribeClick(result);
                    }}
                    className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
                    title="Subscribe"
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Load more trigger - always rendered for observer */}
          <div
            ref={loadMoreRef}
            className="h-20 flex items-center justify-center"
            style={{ visibility: results.length > 0 ? 'visible' : 'hidden' }}
          >
            {isFetching && page > 1 && (
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            )}
          </div>
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
