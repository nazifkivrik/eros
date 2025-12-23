"use client";

import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Film, Calendar, Clock, Users, MapPin, Settings } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useDeleteSubscription, useSubscriptionScenes, useSubscriptionFiles } from "@/hooks/useSubscriptions";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SubscriptionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const deleteSubscription = useDeleteSubscription();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
  const { data: scenesData } = useSubscriptionScenes(id);
  const scenes = scenesData?.data || [];

  // Get files for scene subscriptions
  const { data: filesData } = useSubscriptionFiles(id);
  const sceneFiles = filesData?.files || [];
  const downloadQueue = filesData?.downloadQueue;

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
  const images = entity?.images ? (typeof entity.images === 'string' ? JSON.parse(entity.images) : entity.images) : [];
  const aliases = entity?.aliases ? (typeof entity.aliases === 'string' ? JSON.parse(entity.aliases) : entity.aliases) : [];
  const urls = entity?.urls ? (typeof entity.urls === 'string' ? JSON.parse(entity.urls) : entity.urls) : [];

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
          <Button
            variant="outline"
            onClick={handleEdit}
          >
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
                onValueChange={(value) =>
                  setEditForm({ ...editForm, qualityProfileId: value })
                }
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
                <Carousel className="w-full">
                  <CarouselContent>
                    {images.map((img: any, idx: number) => (
                      <CarouselItem key={idx}>
                        <div className={subscription.entityType === "performer" ? "aspect-[3/4]" : "aspect-video"}>
                          <Image
                            src={img.url}
                            alt={`${subscription.entityName} - Image ${idx + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover"
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
              {subscription.entityType === "performer" && (
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
                    {(entity.careerStartDate || entity.careerEndDate) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Career: {entity.careerStartDate || '?'} - {entity.careerEndDate || 'Present'}
                        </span>
                      </div>
                    )}
                  </div>

                  {entity.bio && (
                    <div className="space-y-2 mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Biography</h3>
                      <p className="text-sm leading-relaxed">{entity.bio}</p>
                    </div>
                  )}

                  {/* Physical Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    {entity.careerLength && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Career Length</h3>
                        <p className="text-sm mt-1">{entity.careerLength}</p>
                      </div>
                    )}
                    {entity.measurements && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Measurements</h3>
                        <p className="text-sm mt-1">{entity.measurements}</p>
                      </div>
                    )}
                    {entity.tattoos && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Tattoos</h3>
                        <p className="text-sm mt-1">{entity.tattoos}</p>
                      </div>
                    )}
                    {entity.piercings && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Piercings</h3>
                        <p className="text-sm mt-1">{entity.piercings}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SCENE METADATA */}
              {subscription.entityType === "scene" && (
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
                    {entity.director && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Director: </span>
                        <span className="font-medium">{entity.director}</span>
                      </div>
                    )}
                  </div>

                  {entity.details && (
                    <div className="space-y-2 mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                      <p className="text-sm leading-relaxed">{entity.details}</p>
                    </div>
                  )}
                </>
              )}

              {/* STUDIO METADATA */}
              {subscription.entityType === "studio" && (
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
                      <Badge key={idx} variant="outline">{alias}</Badge>
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

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
          <CardDescription>
            Manage settings for this subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Entity Type</label>
              <p className="mt-1 capitalize">{subscription.entityType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Quality Profile</label>
              <p className="mt-1">{subscription.qualityProfile?.name || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                  {subscription.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Monitored</label>
              <div className="mt-1">
                <Badge variant={subscription.monitored ? "default" : "outline"}>
                  {subscription.monitored ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Auto Download</label>
              <div className="mt-1">
                <Badge variant={subscription.autoDownload ? "default" : "outline"}>
                  {subscription.autoDownload ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Include Aliases</label>
              <div className="mt-1">
                <Badge variant={subscription.includeAliases ? "default" : "outline"}>
                  {subscription.includeAliases ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Include Metadata Missing</label>
              <div className="mt-1">
                <Badge variant={subscription.includeMetadataMissing ? "default" : "outline"}>
                  {subscription.includeMetadataMissing ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="mt-1">{new Date(subscription.createdAt).toLocaleString()}</p>
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
                  All scenes from this {subscription.entityType} with download status
                </CardDescription>
              </div>
              <Badge variant="outline">{scenes.length} scenes</Badge>
            </div>
          </CardHeader>
          {scenes.length > 0 && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Download Status</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenes.map((scene: any) => (
                    <TableRow key={scene.id}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {scene.isSubscribed ? (
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
                        <Badge
                          variant={
                            scene.downloadStatus === "completed" ? "default" :
                            scene.downloadStatus === "downloading" ? "secondary" :
                            scene.downloadStatus === "queued" ? "outline" :
                            "destructive"
                          }
                        >
                          {scene.downloadStatus === "not_queued" ? "Not Queued" : scene.downloadStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {scene.hasFiles ? (
                            <Badge variant="default">{scene.fileCount} file{scene.fileCount !== 1 ? 's' : ''}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">No files</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {scene.isSubscribed ? (
                          <Badge variant="default">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {scene.date ? new Date(scene.date).toLocaleDateString() : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <Badge variant="outline">{sceneFiles.length} file{sceneFiles.length !== 1 ? 's' : ''}</Badge>
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
                          downloadQueue.status === "completed" ? "default" :
                          downloadQueue.status === "downloading" ? "secondary" :
                          downloadQueue.status === "queued" ? "outline" :
                          "destructive"
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
                    <p className="mt-1 text-sm">{(downloadQueue.size / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Quality</label>
                    <p className="mt-1 text-sm">{downloadQueue.quality}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Added</label>
                    <p className="mt-1 text-sm">{new Date(downloadQueue.addedAt).toLocaleString()}</p>
                  </div>
                  {downloadQueue.completedAt && (
                    <div>
                      <label className="text-sm text-muted-foreground">Completed</label>
                      <p className="mt-1 text-sm">{new Date(downloadQueue.completedAt).toLocaleString()}</p>
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
                      <TableHead>Path</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sceneFiles.map((file: any) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium max-w-md truncate">
                          {file.relativePath}
                        </TableCell>
                        <TableCell>
                          {(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{file.quality}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(file.dateAdded).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground p-4">
                <Film className="h-5 w-5" />
                <p>No files found for this scene. {downloadQueue ? "Download in progress." : "This scene has not been downloaded yet."}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
