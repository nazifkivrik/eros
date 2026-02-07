"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useManualSearch } from "../hooks/useManualSearch";
import { useDownloadToQueue } from "../hooks/useDownloadToQueue";
import { formatBytes } from "@/features/downloads/components/utils";
import type { ManualSearchResult } from "@repo/shared-types";

interface ManualSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneId: string;
  sceneTitle: string;
  performerName?: string;
  sceneDate?: string;
}

export function ManualSearchDialog({
  open,
  onOpenChange,
  sceneId,
  sceneTitle,
  performerName,
  sceneDate,
}: ManualSearchDialogProps) {
  // Query state - default to performer name
  const [query, setQuery] = useState(performerName || sceneTitle);
  const [searchQuery, setSearchQuery] = useState(""); // Actual query for API call

  // Ref for ScrollArea container to calculate height
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState<number | undefined>(undefined);

  // Update query when props change (only if empty)
  useEffect(() => {
    if (!query || query === sceneTitle) {
      setQuery(performerName || sceneTitle);
    }
  }, [performerName, sceneTitle, open]);

  // Auto-search when dialog opens with initial query
  useEffect(() => {
    if (open && query.length >= 3) {
      setSearchQuery(query);
    } else if (!open) {
      setSearchQuery(""); // Reset when dialog closes
    }
  }, [open, query]);

  const { data: results, isLoading, isFetching, error } = useManualSearch(
    sceneId,
    { query: searchQuery, limit: 50 },
    open && searchQuery.length >= 3
  );

  const downloadMutation = useDownloadToQueue(sceneId);

  const handleSearch = () => {
    if (query.length >= 3) {
      setSearchQuery(query);
    }
  };

  const handleDownload = (torrent: ManualSearchResult) => {
    downloadMutation.mutate(torrent, {
      onSuccess: () => {
        toast.success("Download started", {
          description: "Torrent added to queue",
        });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error("Failed to download", {
          description: error.message,
        });
      },
    });
  };

  // Calculate ScrollArea height based on dialog content
  useEffect(() => {
    if (open && scrollAreaRef.current) {
      // Calculate available height: total dialog height minus header and search input
      const dialogContent = scrollAreaRef.current.closest('[class*="max-h-[90vh]"]');
      if (dialogContent) {
        const dialogHeight = dialogContent.clientHeight;
        // Header height (~120px) + search input (~60px) + padding (~48px)
        const fixedContentHeight = 228;
        const availableHeight = dialogHeight - fixedContentHeight;
        setScrollAreaHeight(Math.max(250, availableHeight)); // Minimum 250px
      }
    }
  }, [open, results, isLoading]);

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-green-700 bg-green-50 border-green-200";
    if (score >= 75) return "text-yellow-700 bg-yellow-50 border-yellow-200";
    if (score >= 60) return "text-orange-700 bg-orange-50 border-orange-200";
    return "text-gray-700 bg-gray-50 border-gray-200";
  };

  const getMatchScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 60) return "Fair";
    return "Low";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] min-h-[400px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Manual Search</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <span className="font-medium">{sceneTitle}</span>
            {performerName && (
              <>
                <span className="mx-2">•</span>
                <span>Performer: {performerName}</span>
              </>
            )}
            {sceneDate && (
              <>
                <span className="mx-2">•</span>
                <span>Date: {sceneDate}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col px-6 pb-6 min-h-0 overflow-hidden">
          {/* Search Input */}
          <div className="flex gap-2 shrink-0 mb-4">
            <Input
              placeholder="Search query (e.g., performer name)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={isFetching}
            />
            <Button
              onClick={handleSearch}
              disabled={query.length < 3 || isFetching}
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 shrink-0 mb-4">
              <p className="text-sm text-destructive">
                {error.message || "Failed to search. Please try again."}
              </p>
            </div>
          )}

          {/* Results */}
          <div
            ref={scrollAreaRef}
            className="overflow-hidden min-h-0"
            style={{ height: scrollAreaHeight ? `${scrollAreaHeight}px` : '300px' }}
          >
            <ScrollArea className="h-full pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-3">
                {results.map((torrent, idx) => (
                  <div
                    key={`${torrent.infoHash || torrent.downloadUrl}-${idx}`}
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4
                            className="font-medium text-sm leading-tight"
                            title={torrent.title}
                          >
                            {torrent.title.length > 80 ? torrent.title.substring(0, 80) + '...' : torrent.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium shrink-0 ${getMatchScoreColor(torrent.matchScore)}`}
                          >
                            {torrent.matchScore}%
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-secondary shrink-0">{torrent.quality}</span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0">{torrent.source}</span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0">{formatBytes(torrent.size)}</span>
                          <span className="shrink-0">•</span>
                          <span className="text-green-600 shrink-0">{torrent.seeders}S</span>
                          {torrent.leechers !== undefined && (
                            <>
                              <span className="shrink-0">•</span>
                              <span className="shrink-0">{torrent.leechers}L</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{getMatchScoreLabel(torrent.matchScore)}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleDownload(torrent)}
                        disabled={downloadMutation.isPending}
                        className="shrink-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {query.length < 3
                    ? "Enter at least 3 characters to search"
                    : "No results found. Try a different search query."}
                </p>
              </div>
            )}
          </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
