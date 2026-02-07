"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Film,
  Calendar,
  Clock,
  Users,
  MapPin,
  Settings,
  Info,
  Check,
  X,
  Plus,
  Search,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  useDeleteSubscription,
  useSubscriptionScenes,
  useSubscriptionFiles,
  useSubscribeScene,
  useUnsubscribeScene,
  useResubscribeScene,
} from "@/features/subscriptions";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { ViewToggle } from "@/components/subscriptions/ViewToggle";
import { SubscriptionFilters } from "@/components/subscriptions/SubscriptionFilters";
import { useSubscriptionFilters } from "@/features/subscriptions";
import { ManualSearchDialog } from "@/features/torrent-search";

interface SubscriptionDetailProps {
  id: string;
}

/**
 * @view SubscriptionDetailView
 * @description Subscription detail view with entity information, settings, and scene/file management.
 */
export function SubscriptionDetailView({ id }: SubscriptionDetailProps) {
  const router = useRouter();
  const deleteSubscription = useDeleteSubscription();

  // Scene subscription hooks - pass parent subscription ID for cache invalidation
  const subscribeScene = useSubscribeScene();
  const unsubscribeScene = useUnsubscribeScene(id);
  const resubscribeScene = useResubscribeScene(id);

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Manual search dialog state
  const [manualSearchDialog, setManualSearchDialog] = useState<{
    open: boolean;
    sceneId: string;
    sceneTitle: string;
    performerName?: string;
    sceneDate?: string;
  } | null>(null);

  // URL-based filter state for detail page
  const {
    filters,
    setView,
    setSearch,
    setShowMetadataLess,
    setShowInactive,
    toggleTag,
    clearAllFilters,
  } = useSubscriptionFilters({
    defaultView: "card",
    isDetailPage: true,
  });

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription", id],
    queryFn: () => apiClient.getSubscription(id),
  });

  // Get quality profiles
  const { data: qualityProfilesData } = useQuery({
    queryKey: ["quality-profiles"],
    queryFn: () => apiClient.getQualityProfiles(),
  });
  const qualityProfiles = qualityProfilesData?.data || [];

  // Get scenes for performer/studio subscriptions with download status
  const scenesData = useSubscriptionScenes(
    subscription?.entityType === "performer" || subscription?.entityType === "studio" ? id : "",
    true // Enable query
  );
  const allScenes = scenesData.data || [];

  // Get all unique tags from scenes
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    allScenes.forEach((scene: any) => {
      if (scene?.tags) {
        scene.tags.forEach((tag: any) => tagSet.add(tag.name));
      }
    });
    return Array.from(tagSet).sort();
  }, [allScenes]);

  // Filter scenes based on URL state
  const filteredScenes = useMemo(() => {
    let filtered = allScenes;

    // Search filtering
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter((s: any) => s.title?.toLowerCase().includes(search));
    }

    // Tag filtering
    if (filters.tags.length > 0) {
      filtered = filtered.filter((s: any) => {
        const sceneTags = s?.tags?.map((t: any) => t.name) || [];
        return filters.tags!.some((tag) => sceneTags.includes(tag));
      });
    }

    // Show only metadata-less filtering
    if (filters.showMetadataLess) {
      filtered = filtered.filter((s: any) => s.hasMetadata === false);
    }

    // Show inactive filtering - when disabled, hide unsubscribed scenes
    if (!filters.showInactive) {
      filtered = filtered.filter((s: any) => s.isSubscribed === true);
    }

    return filtered;
  }, [allScenes, filters]);

  // Get files for scene subscriptions
  const { data: filesData } = useSubscriptionFiles(
    subscription?.entityType === "scene" ? id : ""
  );
  const sceneFiles = filesData?.files || [];
  const downloadQueue = filesData?.downloadQueue;
  const sceneFolder = filesData?.sceneFolder;
  const folderContents = filesData?.folderContents || { nfoFiles: [], posterFiles: [], videoFiles: [] };

  // Form state for editing
  const [editForm, setEditForm] = useState({
    qualityProfileId: "",
    autoDownload: false,
    includeMetadataMissing: false,
    includeAliases: false,
  });

  // Update mutation
  const updateSubscription = useMutationWithToast({
    mutationFn: (data: any) => apiClient.updateSubscription(id, data),
    successMessage: "Subscription updated successfully",
    errorMessage: "Failed to update subscription",
    invalidateKeys: [["subscription", id], ["subscriptions"]],
  });

  const handleEdit = () => {
    if (subscription) {
      setEditForm({
        qualityProfileId: subscription.qualityProfileId || "",
        autoDownload: subscription.autoDownload || false,
        includeMetadataMissing: subscription.includeMetadataMissing || false,
        includeAliases: subscription.includeAliases || false,
      });
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    updateSubscription.mutate(editForm, {
      onSuccess: () => {
        setEditDialogOpen(false);
      },
    });
  };

  const handleDelete = () => {
    deleteSubscription.mutate(
      { id, deleteAssociatedScenes: subscription?.entityType !== "scene" },
      {
        onSuccess: () => {
          router.push("/subscriptions");
        },
      }
    );
  };

  // Helper to get the best image URL from scene data
  // For scenes, prefer background (landscape) over poster (portrait)
  const getSceneImageUrl = (scene: any): string | null => {
    if (!scene) return null;

    // === PREFER background (landscape) ===
    if (scene.background) {
      if (typeof scene.background === "object") {
        return scene.background.full || scene.background.large || Object.values(scene.background)[0];
      }
      return scene.background;
    }
    // Fallback to background_back
    if (scene.background_back) {
      if (typeof scene.background_back === "object") {
        return scene.background_back.full || scene.background_back.large || Object.values(scene.background_back)[0];
      }
      return scene.background_back;
    }
    // Fallback to image (horizontal/landscape)
    if (scene.image) return scene.image;
    // Fallback to back_image
    if (scene.back_image) return scene.back_image;

    // === CHECK images array for background-type images ===
    if (scene.images && scene.images.length > 0) {
      // Prefer images with /background/ in URL
      const backgroundImg = scene.images.find((img: any) =>
        img.url?.includes("/background/") || img.type === "background"
      );
      if (backgroundImg) return backgroundImg.url;
      // Fallback to first image
      if (scene.images[0]?.url) return scene.images[0].url;
    }

    // === LAST RESORT: poster (portrait) ===
    if (scene.poster) return scene.poster;

    return null;
  };

  // Handle scene subscribe/unsubscribe
  const handleSubscribeScene = (sceneId: string) => {
    // Get quality profile from parent subscription
    const qualityProfileId = subscription?.qualityProfileId || "";
    subscribeScene.mutate({ sceneId, qualityProfileId });
  };

  const handleUnsubscribeScene = (subscriptionId: string) => {
    unsubscribeScene.mutate({ subscriptionId });
  };

  const handleResubscribeScene = (subscriptionId: string) => {
    resubscribeScene.mutate({ subscriptionId });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <Film className="h-5 w-5" />
              <p className="font-medium">Subscription not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse entity data safely
  const entity = subscription?.entity;
  const images = entity?.images || [];
  const aliases = entity && "aliases" in entity ? entity.aliases : [];
  const urls = entity && "urls" in entity && Array.isArray(entity.urls) ? entity.urls : [];

  // Helper functions
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {subscription.entityName || subscription.entityId}
            </h1>
            <p className="text-muted-foreground capitalize">
              {subscription.entityType} Subscription
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Settings className="h-4 w-4 mr-2" />
            Edit Settings
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteSubscription.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Edit Subscription Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription Settings</DialogTitle>
            <DialogDescription>
              Update quality profile and download settings for this subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qualityProfile">Quality Profile</Label>
              <Select
                value={editForm.qualityProfileId}
                onValueChange={(value) => setEditForm({ ...editForm, qualityProfileId: value })}
              >
                <SelectTrigger id="qualityProfile">
                  <SelectValue placeholder="Select quality profile" />
                </SelectTrigger>
                <SelectContent>
                  {qualityProfiles.map((profile: any) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoDownload"
                checked={editForm.autoDownload}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, autoDownload: checked as boolean })
                }
              />
              <Label
                htmlFor="autoDownload"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Auto Download
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeMetadataMissing"
                checked={editForm.includeMetadataMissing}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, includeMetadataMissing: checked as boolean })
                }
              />
              <Label
                htmlFor="includeMetadataMissing"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include Metadata Missing
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeAliases"
                checked={editForm.includeAliases}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, includeAliases: checked as boolean })
                }
              />
              <Label
                htmlFor="includeAliases"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include Aliases
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateSubscription.isPending}>
              {updateSubscription.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Details Card */}
      {entity && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Image Carousel */}
            {images.length > 0 && (
              <div className="md:col-span-1">
                <Carousel className="w-full" opts={{ loop: true }}>
                  <CarouselContent>
                    {images.map((img: any, idx: number) => (
                      <CarouselItem key={idx}>
                        <div
                          className={`relative w-full ${
                            subscription.entityType === "performer" ? "aspect-[3/4]" : "aspect-video"
                          } overflow-hidden rounded-lg`}
                        >
                          <Image
                            src={img.url}
                            alt={`${subscription.entityName} - Image ${idx + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2" />
                      <CarouselNext className="right-2" />
                    </>
                  )}
                </Carousel>
              </div>
            )}

            {/* Entity Information */}
            <div className={images.length > 0 ? "md:col-span-2 p-6" : "md:col-span-3 p-6"}>
              <h2 className="text-2xl font-bold mb-4">{subscription.entityName}</h2>

              {/* PERFORMER METADATA */}
              {subscription.entityType === "performer" && entity && "gender" in entity && (
                <>
                  {/* Basic Info */}
                  <div className="space-y-3 mb-4">
                    {entity.gender && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize">{entity.gender}</span>
                      </div>
                    )}
                    {entity.birthdate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Born: {formatDate(entity.birthdate)}</span>
                      </div>
                    )}
                    {entity.birthplace && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{entity.birthplace}</span>
                      </div>
                    )}
                    {(entity.careerStartYear || entity.careerEndYear) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Career: {entity.careerStartYear || "?"} - {entity.careerEndYear || "Present"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ethnicity & Nationality */}
                  {(entity.ethnicity || entity.nationality) && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-3 text-sm">
                        {entity.ethnicity && (
                          <>
                            <span className="text-muted-foreground">Ethnicity:</span>
                            <span className="font-medium">{entity.ethnicity}</span>
                          </>
                        )}
                        {entity.ethnicity && entity.nationality && <span className="text-muted-foreground">•</span>}
                        {entity.nationality && (
                          <>
                            <span className="text-muted-foreground">Nationality:</span>
                            <span className="font-medium">{entity.nationality}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Physical Appearance */}
                  {(entity.hairColour || entity.eyeColour || entity.height || entity.weight) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                      {entity.hairColour && (
                        <div>
                          <h3 className="text-xs text-muted-foreground mb-1">Hair</h3>
                          <p className="text-sm font-medium capitalize">{entity.hairColour}</p>
                        </div>
                      )}
                      {entity.eyeColour && (
                        <div>
                          <h3 className="text-xs text-muted-foreground mb-1">Eyes</h3>
                          <p className="text-sm font-medium capitalize">{entity.eyeColour}</p>
                        </div>
                      )}
                      {entity.height && (
                        <div>
                          <h3 className="text-xs text-muted-foreground mb-1">Height</h3>
                          <p className="text-sm font-medium">{entity.height} cm</p>
                        </div>
                      )}
                      {entity.weight && (
                        <div>
                          <h3 className="text-xs text-muted-foreground mb-1">Weight</h3>
                          <p className="text-sm font-medium">{entity.weight} kg</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Measurements */}
                  {(entity.measurements || entity.cupsize) && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Measurements:</span>
                      <span className="text-sm font-medium">{entity.measurements}</span>
                      {entity.cupsize && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm font-medium">{entity.cupsize}</span>
                        </>
                      )}
                    </div>
                  )}

                  {entity.bio && (
                    <div className="space-y-2 mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Biography</h3>
                      <p className="text-sm leading-relaxed">{entity.bio}</p>
                    </div>
                  )}

                  {/* Body Modifications */}
                  {(entity.tattoos || entity.piercings) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                      {entity.tattoos && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-1">
                            Tattoos
                          </h3>
                          <p className="text-sm">{entity.tattoos}</p>
                        </div>
                      )}
                      {entity.piercings && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-1">
                            Piercings
                          </h3>
                          <p className="text-sm">{entity.piercings}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* SCENE METADATA */}
              {subscription.entityType === "scene" && entity && "date" in entity && (
                <>
                  {/* Scene Details */}
                  <div className="space-y-3 mb-4">
                    {entity.date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Released: {formatDate(entity.date)}</span>
                      </div>
                    )}
                    {entity.duration && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Duration: {formatDuration(entity.duration)}</span>
                      </div>
                    )}
                    {entity.code && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Scene Code: </span>
                        <span className="font-medium">{entity.code}</span>
                      </div>
                    )}
                  </div>

                  {entity.description && (
                    <div className="space-y-2 mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                      <p className="text-sm leading-relaxed">{entity.description}</p>
                    </div>
                  )}
                </>
              )}

              {/* STUDIO METADATA */}
              {subscription.entityType === "studio" && entity && "parentStudioId" in entity && (
                <>
                  {entity.url && (
                    <div className="mb-4">
                      <a
                        href={entity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {entity.url}
                      </a>
                    </div>
                  )}
                  {entity.parentStudioId && (
                    <div className="text-sm mb-4">
                      <span className="text-muted-foreground">Parent Studio: </span>
                      <span className="font-medium">{entity.parentStudioId}</span>
                    </div>
                  )}
                </>
              )}

              {/* ALIASES (all entity types) */}
              {aliases.length > 0 && (
                <div className="pt-4 border-t mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Aliases</h3>
                  <div className="flex gap-2 flex-wrap">
                    {aliases.map((alias: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {alias}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* URLS (scenes) */}
              {urls.length > 0 && (
                <div className="pt-4 border-t mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Links</h3>
                  <div className="space-y-1">
                    {urls.map((url: string, idx: number) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary hover:underline truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Subscription Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription Details
          </CardTitle>
          <CardDescription>
            Configuration and monitoring settings for this subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Entity Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Entity Type</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-sm px-3 py-1">
                  {subscription.entityType}
                </Badge>
              </div>
            </div>

            {/* Status - Different for performer/studio vs scene */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                {subscription.entityType === "scene" ? "Subscribed" : "Auto Download"}
              </label>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    subscription.entityType === "scene"
                      ? (subscription.isSubscribed ? "default" : "secondary")
                      : (subscription.autoDownload ? "default" : "secondary")
                  }
                  className="px-3 py-1"
                >
                  {subscription.entityType === "scene"
                    ? (subscription.isSubscribed ? "Yes" : "No")
                    : (subscription.autoDownload ? "On" : "Off")
                  }
                </Badge>
              </div>
            </div>

            {/* Quality Profile */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Quality Profile</label>
              <div className="text-sm font-medium">
                {subscription.qualityProfile?.name || "N/A"}
              </div>
            </div>

            {/* Auto Download */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Auto Download</label>
              <div className="flex items-center gap-2">
                <Badge variant={subscription.autoDownload ? "default" : "outline"}>
                  {subscription.autoDownload ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {subscription.autoDownload && (
                <p className="text-xs text-muted-foreground">
                  Automatically adds matching torrents to download queue
                </p>
              )}
            </div>

            {/* Include Metadata Missing */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Include Metadata Missing
              </label>
              <div className="flex items-center gap-2">
                <Badge
                  variant={subscription.includeMetadataMissing ? "default" : "outline"}
                  className={subscription.includeMetadataMissing ? "bg-amber-600" : ""}
                >
                  {subscription.includeMetadataMissing ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {subscription.includeMetadataMissing && (
                <p className="text-xs text-muted-foreground">
                  Discovers scenes without metadata from multiple indexers
                </p>
              )}
            </div>

            {/* Include Aliases */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Include Aliases</label>
              <div className="flex items-center gap-2">
                <Badge variant={subscription.includeAliases ? "default" : "outline"}>
                  {subscription.includeAliases ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {subscription.includeAliases && aliases.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Searching with {aliases.length} alias{aliases.length > 1 ? "es" : ""}
                </p>
              )}
            </div>

            {/* Created Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <div className="text-sm">
                {new Date(subscription.createdAt).toLocaleDateString()} •{" "}
                {new Date(subscription.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            {/* Stats Summary */}
            {(subscription.entityType === "performer" || subscription.entityType === "studio") && (
              <div className="space-y-2 md:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium text-muted-foreground">Library Stats</label>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-medium">{allScenes.length}</span>
                    <span className="text-muted-foreground ml-1">scenes</span>
                  </div>
                  <div>
                    <span className="font-medium">{allScenes.filter((s: any) => s.hasFiles).length}</span>
                    <span className="text-muted-foreground ml-1">downloaded</span>
                  </div>
                  <div>
                    <span className="font-medium">
                      {allScenes.filter((s: any) => !s.hasMetadata).length}
                    </span>
                    <span className="text-muted-foreground ml-1">no metadata</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">About This Subscription</p>
                <p className="text-muted-foreground">
                  {subscription.entityType === "performer" &&
                    "This subscription monitors for new scenes featuring this performer across all indexers."}
                  {subscription.entityType === "studio" &&
                    "This subscription monitors for new releases from this studio."}
                  {subscription.entityType === "scene" &&
                    "This subscription tracks a specific scene and its download status."}
                </p>
                {subscription.includeMetadataMissing && (
                  <p className="text-amber-700 dark:text-amber-400 mt-2">
                    <strong>Metadata Missing:</strong> Scenes discovered without metadata will be
                    shown with a &quot;No Metadata&quot; badge. These are inferred from multiple indexer
                    matches.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Scenes (for performer/studio subscriptions) */}
      {(subscription.entityType === "performer" || subscription.entityType === "studio") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  All Scenes
                </CardTitle>
                <CardDescription>
                  Scenes from this {subscription.entityType} including metadata-less discoveries
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {filteredScenes.length} / {allScenes.length} scenes
                </Badge>
                <ViewToggle view={filters.view} onViewChange={setView} />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="pt-4 border-t">
              <SubscriptionFilters
                search={filters.search}
                onSearchChange={setSearch}
                showMetadataLess={filters.showMetadataLess}
                onMetadataLessChange={setShowMetadataLess}
                showInactive={filters.showInactive}
                onInactiveChange={setShowInactive}
                selectedTags={filters.tags}
                onTagToggle={toggleTag}
                onClearTags={clearAllFilters}
                availableTags={availableTags}
                showTagFilter={true}
              />
            </div>
          </CardHeader>

          {filteredScenes.length > 0 ? (
            <CardContent>
              {/* Grid View - Card Layout */}
              {filters.view === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredScenes.map((scene: any) => (
                    <Card
                      key={scene.id}
                      className={cn(
                        "overflow-hidden hover:shadow-md transition-shadow",
                        !scene.isSubscribed && "opacity-60 grayscale-[50%]"
                      )}
                    >
                      {/* Scene Image/Placeholder */}
                      <div className="relative aspect-video bg-muted">
                        {getSceneImageUrl(scene) ? (
                          <Image
                            src={getSceneImageUrl(scene)!}
                            alt={scene.title}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Film className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* Metadata Badge */}
                        {scene.hasMetadata === false && (
                          <Badge className="absolute top-2 left-2 bg-amber-500/90 text-white border-amber-600">
                            <Info className="h-3 w-3 mr-1" />
                            No Metadata
                          </Badge>
                        )}
                        {/* Download Status Badge */}
                        <Badge
                          variant={scene.downloadStatus === "completed" ? "default" : "secondary"}
                          className="absolute top-2 right-2"
                        >
                          {scene.downloadStatus === "not_queued" ? "Not Queued" : scene.downloadStatus}
                        </Badge>
                      </div>

                      {/* Scene Info */}
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <h3 className="font-medium line-clamp-2" title={scene.title}>
                            {scene.subscriptionId ? (
                              <Link
                                href={`/subscriptions/${scene.subscriptionId}`}
                                className="hover:text-primary transition-colors"
                              >
                                {scene.title}
                              </Link>
                            ) : (
                              scene.title
                            )}
                          </h3>
                          {scene.date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(scene.date)}
                            </p>
                          )}
                        </div>

                        {/* Scene Stats */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Film className="h-3 w-3" />
                            {scene.fileCount || 0} files
                          </span>

                          {/* Download Status Badge */}
                          {scene.downloadStatus !== "not_queued" && scene.downloadStatus && (
                            <Badge
                              variant={
                                scene.downloadStatus === "completed"
                                  ? "default"
                                  : scene.downloadStatus === "downloading"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs"
                            >
                              {scene.downloadStatus === "completed" && "✓"}
                              {scene.downloadStatus === "downloading" && "⬇"}
                              {scene.downloadStatus === "queued" && "⏳"}
                            </Badge>
                          )}
                        </div>

                        {/* Subscription Status & Action */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <Badge
                              variant={scene.isSubscribed ? "default" : "secondary"}
                              className={cn(
                                "text-xs",
                                scene.isSubscribed ? "bg-green-600" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {scene.isSubscribed ? "✓ Active" : "○ Inactive"}
                            </Badge>
                          </div>

                          {/* Action Button */}
                          <div className="flex gap-2">
                            {(scene.downloadStatus === "not_queued" || scene.downloadStatus === "add_failed") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setManualSearchDialog({
                                    open: true,
                                    sceneId: scene.id,
                                    sceneTitle: scene.title,
                                    performerName: subscription?.entityName || scene.performers?.[0]?.name,
                                    sceneDate: scene.date,
                                  });
                                }}
                              >
                                <Search className="h-3.5 w-3.5 mr-1" />
                                Manual Search
                              </Button>
                            )}
                            {scene.subscriptionId ? (
                              // Scene has individual subscription - show unsubscribe/resubscribe
                              <Button
                                variant={scene.isSubscribed ? "ghost" : "default"}
                                size="sm"
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  scene.isSubscribed
                                    ? handleUnsubscribeScene(scene.subscriptionId)
                                    : handleResubscribeScene(scene.subscriptionId);
                                }}
                                disabled={
                                  (scene.isSubscribed && unsubscribeScene.isPending) ||
                                  (!scene.isSubscribed && resubscribeScene.isPending)
                                }
                              >
                                {scene.isSubscribed ? (
                                  <>
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Unsubscribe
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Resubscribe
                                  </>
                                )}
                              </Button>
                            ) : (
                              // Scene has no individual subscription - show subscribe button
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSubscribeScene(scene.id);
                                }}
                                disabled={subscribeScene.isPending}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Subscribe
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* File Details (if has files) */}
                        {scene.hasFiles && scene.sceneFiles && scene.sceneFiles.length > 0 && (
                          <div className="pt-3 border-t space-y-2">
                            {scene.sceneFiles.map((file: any) => (
                              <div key={file.id} className="text-xs">
                                <div className="font-mono text-muted-foreground truncate" title={file.filePath}>
                                  {file.filePath.split("/").pop()}
                                </div>
                                <div className="text-muted-foreground">
                                  {(file.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Download Progress (if downloading) */}
                        {scene.downloadProgress && (
                          <div className="pt-3 border-t">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Download Progress</span>
                              <span className="font-medium">{scene.downloadProgress.progress || 0}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${scene.downloadProgress.progress || 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Table View */}
              {filters.view === "table" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Metadata</TableHead>
                      <TableHead>Download Status</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScenes.map((scene: any) => (
                      <TableRow
                        key={scene.id}
                        className={!scene.isSubscribed ? "opacity-60 bg-muted/30" : ""}
                      >
                        <TableCell className="font-medium max-w-xs truncate">
                          {scene.subscriptionId ? (
                            <Link
                              href={`/subscriptions/${scene.subscriptionId}`}
                              className="hover:underline"
                            >
                              {scene.title}
                            </Link>
                          ) : (
                            <span>{scene.title}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {scene.hasMetadata === false ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              <Info className="h-3 w-3 mr-1" />
                              No Metadata
                            </Badge>
                          ) : (
                            <Badge variant="default">Full Metadata</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              scene.downloadStatus === "completed"
                                ? "default"
                                : scene.downloadStatus === "downloading"
                                  ? "secondary"
                                  : scene.downloadStatus === "queued"
                                    ? "outline"
                                    : "destructive"
                            }
                          >
                            {scene.downloadStatus === "not_queued" ? "Not Queued" : scene.downloadStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {scene.hasFiles ? (
                              <>
                                <Badge variant="default">
                                  {scene.fileCount} file{scene.fileCount !== 1 ? "s" : ""}
                                </Badge>
                                {scene.sceneFiles && scene.sceneFiles.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {scene.sceneFiles.map((file: any) => (
                                      <div
                                        key={file.id}
                                        className="text-xs font-mono bg-muted/50 p-2 rounded"
                                      >
                                        <div className="font-medium mb-1">Video:</div>
                                        <div className="truncate max-w-xs mb-1" title={file.filePath}>
                                          {file.filePath}
                                        </div>
                                        {file.nfoPath && (
                                          <div className="truncate max-w-xs text-muted-foreground" title={file.nfoPath}>
                                            NFO: {file.nfoPath}
                                          </div>
                                        )}
                                        {file.posterPath && (
                                          <div className="truncate max-w-xs text-muted-foreground" title={file.posterPath}>
                                            Poster: {file.posterPath}
                                          </div>
                                        )}
                                        <div className="text-muted-foreground mt-1">
                                          {(file.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">No files</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* Subscription Status Badge - shows scene subscription intent, not download status */}
                          <Badge
                            variant={scene.isSubscribed ? "default" : "secondary"}
                            className={cn(
                              "w-fit",
                              scene.isSubscribed ? "bg-green-600" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {scene.isSubscribed ? "✓ Active" : "○ Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {/* Action Button */}
                          {scene.subscriptionId ? (
                            // Scene has individual subscription - show unsubscribe/resubscribe
                            <Button
                              variant={scene.isSubscribed ? "ghost" : "default"}
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                scene.isSubscribed
                                  ? handleUnsubscribeScene(scene.subscriptionId)
                                  : handleResubscribeScene(scene.subscriptionId)
                              }
                              disabled={
                                (scene.isSubscribed && unsubscribeScene.isPending) ||
                                (!scene.isSubscribed && resubscribeScene.isPending)
                              }
                              title={scene.isSubscribed ? "Unsubscribe" : "Resubscribe"}
                            >
                              {scene.isSubscribed ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          ) : (
                            // Scene has no individual subscription - show subscribe button
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleSubscribeScene(scene.id)}
                              disabled={subscribeScene.isPending}
                              title="Subscribe"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {scene.date ? formatDate(scene.date) : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          ) : (
            <CardContent>
              <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
                <Film className="h-8 w-8" />
                <p>
                  {filters.search ||
                  filters.tags.length > 0 ||
                  filters.showMetadataLess
                    ? `No scenes match your filters for this ${subscription.entityType}`
                    : `No scenes found for this ${subscription.entityType}`}
                </p>
                {(filters.search ||
                  filters.tags.length > 0 ||
                  filters.showMetadataLess) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setShowMetadataLess(false);
                      clearAllFilters();
                    }}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Scene Files (for scene subscriptions) */}
      {subscription?.entityType === "scene" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  Scene Files & Download Status
                </CardTitle>
                <CardDescription>
                  Files in this scene&apos;s folder and download progress
                </CardDescription>
              </div>
              <Badge variant="outline">
                {sceneFiles.length} file{sceneFiles.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {downloadQueue && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-medium mb-3">Download Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge
                        variant={
                          downloadQueue.status === "completed"
                            ? "default"
                            : downloadQueue.status === "downloading"
                              ? "secondary"
                              : downloadQueue.status === "queued"
                                ? "outline"
                                : "destructive"
                        }
                      >
                        {downloadQueue.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Title</label>
                    <p className="mt-1 text-sm truncate">{downloadQueue.title}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Size</label>
                    <p className="mt-1 text-sm">
                      {(downloadQueue.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Quality</label>
                    <p className="mt-1 text-sm">{downloadQueue.quality || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Added</label>
                    <p className="mt-1 text-sm">
                      {downloadQueue.addedAt ? new Date(downloadQueue.addedAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                  {downloadQueue.completedAt && (
                    <div>
                      <label className="text-sm text-muted-foreground">Completed</label>
                      <p className="mt-1 text-sm">
                        {new Date(downloadQueue.completedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {sceneFiles.length > 0 ? (
              <div>
                <h3 className="font-medium mb-3">Files</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Files</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sceneFiles.map((file: any) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-mono text-xs max-w-md">
                          <div className="space-y-1">
                            <div className="font-medium">Video:</div>
                            <div className="truncate" title={file.filePath}>
                              {file.filePath}
                            </div>
                            {file.nfoPath && (
                              <div className="truncate text-muted-foreground" title={file.nfoPath}>
                                NFO: {file.nfoPath}
                              </div>
                            )}
                            {file.posterPath && (
                              <div className="truncate text-muted-foreground" title={file.posterPath}>
                                Poster: {file.posterPath}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(file.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{file.quality || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show folder contents if available */}
                {folderContents.nfoFiles.length > 0 ||
                folderContents.posterFiles.length > 0 ||
                folderContents.videoFiles.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-medium">Folder Contents</h3>

                    {folderContents.nfoFiles.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Badge variant="outline">NFO Files</Badge>
                          <span className="text-xs text-muted-foreground">
                            {folderContents.nfoFiles.length}
                          </span>
                        </h4>
                        <ul className="text-xs font-mono space-y-1">
                          {folderContents.nfoFiles.map((file: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground">
                              ✓ {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {folderContents.posterFiles.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Badge variant="outline">Poster Files</Badge>
                          <span className="text-xs text-muted-foreground">
                            {folderContents.posterFiles.length}
                          </span>
                        </h4>
                        <ul className="text-xs font-mono space-y-1">
                          {folderContents.posterFiles.map((file: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground">
                              ✓ {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {folderContents.videoFiles.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Badge variant="default">Video Files</Badge>
                          <span className="text-xs text-muted-foreground">
                            {folderContents.videoFiles.length}
                          </span>
                        </h4>
                        <ul className="text-xs font-mono space-y-1">
                          {folderContents.videoFiles.map((file: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground">
                              ✓ {file}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-amber-600 mt-2">
                          ⚠️ Video files found but not in database. The filesystem sync job will add them
                          when it runs.
                        </p>
                      </div>
                    )}

                    {sceneFolder && (
                      <div className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                        <h4 className="font-medium mb-1 text-xs">Folder Path</h4>
                        <p className="text-xs font-mono text-muted-foreground break-all">
                          {sceneFolder}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-muted-foreground p-4">
                      <Film className="h-5 w-5" />
                      <p>
                        No files found for this scene.{" "}
                        {downloadQueue ? "Download in progress." : "This scene has not been downloaded yet."}
                      </p>
                    </div>
                    {sceneFolder && (
                      <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                        <h4 className="font-medium mb-2 text-sm">Expected Scene Folder</h4>
                        <p className="text-sm font-mono text-muted-foreground break-all">
                          {sceneFolder}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          When you subscribe to a scene, .nfo and poster files are created here. Video
                          files will appear after download completes.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Search Dialog */}
      {manualSearchDialog && (
        <ManualSearchDialog
          open={manualSearchDialog.open}
          onOpenChange={(open) => setManualSearchDialog(open ? manualSearchDialog : null)}
          sceneId={manualSearchDialog.sceneId}
          sceneTitle={manualSearchDialog.sceneTitle}
          performerName={manualSearchDialog.performerName}
          sceneDate={manualSearchDialog.sceneDate}
        />
      )}
    </div>
  );
}
