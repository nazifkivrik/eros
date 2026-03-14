"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export type ViewMode = "card" | "table";
export type TabType = "performers" | "studios" | "scenes";

interface SubscriptionFilters {
  view: ViewMode;
  search: string;
  tags: string[];
  // Main page specific
  tab?: TabType;
  includeMetaless?: boolean;
  // Detail page specific
  activeOnly?: boolean;
  showMetadataLess?: boolean;
  showInactive?: boolean;
  // New advanced filters
  performers?: string[];
  downloadStatus?: 'all' | 'downloaded' | 'downloading' | 'not_downloaded';
}

interface UseSubscriptionFiltersOptions {
  defaultView?: ViewMode;
  defaultTab?: TabType;
  // For detail page
  isDetailPage?: boolean;
}

interface UseSubscriptionFiltersReturn {
  filters: SubscriptionFilters;
  setView: (view: ViewMode) => void;
  setSearch: (search: string) => void;
  setTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setTab: (tab: TabType) => void;
  setIncludeMetaless: (value: boolean) => void;
  setActiveOnly: (value: boolean) => void;
  setShowMetadataLess: (value: boolean) => void;
  setShowInactive: (value: boolean) => void;
  // New advanced filter setters
  setPerformers: (performers: string[]) => void;
  togglePerformer: (performerId: string) => void;
  setDownloadStatus: (status: 'all' | 'downloaded' | 'downloading' | 'not_downloaded') => void;
  clearAllFilters: () => void;
}

export function useSubscriptionFilters(
  options: UseSubscriptionFiltersOptions = {}
): UseSubscriptionFiltersReturn {
  const { defaultView = "table", defaultTab = "performers", isDetailPage = false } = options;

  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse URL params
  const filters: SubscriptionFilters = {
    view: (searchParams.get("view") as ViewMode) || defaultView,
    search: searchParams.get("q") || "",
    tags: searchParams.get("tags")?.split(",").filter(Boolean) || [],
    // Only parse tab on main page
    tab: isDetailPage ? undefined : ((searchParams.get("tab") as TabType) || defaultTab),
    // Default to false (don't include metaless unless checkbox is checked)
    includeMetaless: searchParams.get("includeMetaless") === "true",
    activeOnly: searchParams.get("activeOnly") === "true",
    showMetadataLess: searchParams.get("showMetadataLess") === "true",
    // For detail page, default to true (show unsubscribed scenes)
    // For main page, default to false (show only active subscriptions)
    showInactive: isDetailPage
      ? searchParams.get("showInactive") !== "false"  // default true unless explicitly false
      : searchParams.get("showInactive") === "true",  // default false, must be explicitly true
    // New advanced filters
    performers: searchParams.get("performers")?.split(",").filter(Boolean) || [],
    downloadStatus: (searchParams.get("downloadStatus") as 'all' | 'downloaded' | 'downloading' | 'not_downloaded') || 'all',
  };

  // Update URL params
  const updateUrl = useCallback(
    (updates: Record<string, string | string[] | boolean | undefined>) => {
      const params = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.set(key, value.join(","));
        } else if (typeof value === "boolean") {
          params.set(key, value ? "true" : "false");
        } else {
          params.set(key, String(value));
        }
      });

      // Keep the current path, just update search params
      const newUrl = params.toString() ? `?${params.toString()}` : "";
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, router]
  );

  // Individual setters
  const setView = useCallback(
    (view: ViewMode) => {
      updateUrl({ view });
    },
    [updateUrl]
  );

  const setSearch = useCallback(
    (search: string) => {
      updateUrl({ q: search });
    },
    [updateUrl]
  );

  const setTags = useCallback(
    (tags: string[]) => {
      updateUrl({ tags });
    },
    [updateUrl]
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const newTags = filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag];
      updateUrl({ tags: newTags });
    },
    [filters.tags, updateUrl]
  );

  const setTab = useCallback(
    (tab: TabType) => {
      updateUrl({ tab });
    },
    [updateUrl]
  );

  const setIncludeMetaless = useCallback(
    (value: boolean) => {
      updateUrl({ includeMetaless: value });
    },
    [updateUrl]
  );

  const setActiveOnly = useCallback(
    (value: boolean) => {
      updateUrl({ activeOnly: value });
    },
    [updateUrl]
  );

  const setShowMetadataLess = useCallback(
    (value: boolean) => {
      updateUrl({ showMetadataLess: value });
    },
    [updateUrl]
  );

  const setShowInactive = useCallback(
    (value: boolean) => {
      updateUrl({ showInactive: value });
    },
    [updateUrl]
  );

  // New advanced filter setters
  const setPerformers = useCallback(
    (performers: string[]) => {
      updateUrl({ performers });
    },
    [updateUrl]
  );

  const togglePerformer = useCallback(
    (performerId: string) => {
      const newPerformers = filters.performers?.includes(performerId)
        ? filters.performers.filter((p) => p !== performerId)
        : [...(filters.performers || []), performerId];
      updateUrl({ performers: newPerformers });
    },
    [filters.performers, updateUrl]
  );

  const setDownloadStatus = useCallback(
    (status: 'all' | 'downloaded' | 'downloading' | 'not_downloaded') => {
      updateUrl({ downloadStatus: status === 'all' ? undefined : status });
    },
    [updateUrl]
  );

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    // Clear filter-related params, but keep view
    params.delete("q");
    params.delete("tags");
    params.delete("includeMetaless");
    params.delete("activeOnly");
    params.delete("showMetadataLess");
    params.delete("showInactive");
    params.delete("performers");
    params.delete("downloadStatus");

    const newUrl = params.toString() ? `?${params.toString()}` : "";
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  return {
    filters,
    setView,
    setSearch,
    setTags,
    toggleTag,
    setTab,
    setIncludeMetaless,
    setActiveOnly,
    setShowMetadataLess,
    setShowInactive,
    setPerformers,
    togglePerformer,
    setDownloadStatus,
    clearAllFilters,
  };
}
