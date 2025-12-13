"use client";

import Image from "next/image";
import { useSceneDetails } from "@/hooks/useSearch";
import { useCheckSubscription } from "@/hooks/useSubscriptions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Film, Link as LinkIcon, Check } from "lucide-react";

interface SceneDetailDialogProps {
  sceneId: string | null;
  onClose: () => void;
  onSubscribe: (scene: any) => void;
}

export function SceneDetailDialog({
  sceneId,
  onClose,
  onSubscribe,
}: SceneDetailDialogProps) {
  const { data: scene, isLoading } = useSceneDetails(sceneId || "");

  const { data: subscriptionStatus, isLoading: isCheckingSubscription } =
    useCheckSubscription("scene", sceneId || "");

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Dialog open={!!sceneId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isLoading ? "Loading..." : scene?.title || "Scene Details"}
            {!isCheckingSubscription && subscriptionStatus?.isSubscribed && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Subscribed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading scene details"
              : scene?.studio?.name
                ? `${scene.studio.name}${scene.date ? ` - ${formatDate(scene.date)}` : ""}`
                : "Scene details and information"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : scene ? (
          <>

            <div className="space-y-6">
              {/* Images Carousel */}
              {scene.images && scene.images.length > 0 && (
                <Carousel className="w-full">
                  <CarouselContent>
                    {scene.images.map((img: any, idx: number) => (
                      <CarouselItem key={idx}>
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                          <Image
                            src={img.url}
                            alt={`${scene.title} - Image ${idx + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {scene.images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2" />
                      <CarouselNext className="right-2" />
                    </>
                  )}
                </Carousel>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                {scene.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Released: {formatDate(scene.date)}</span>
                  </div>
                )}

                {scene.duration && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Duration: {formatDuration(scene.duration)}</span>
                  </div>
                )}

                {scene.studio && (
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Studio: {scene.studio.name}</span>
                  </div>
                )}

                {scene.code && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Code: </span>
                    <span className="font-medium">{scene.code}</span>
                  </div>
                )}
              </div>

              {scene.director && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Director: </span>
                  <span className="font-medium">{scene.director}</span>
                </div>
              )}

              {scene.details && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">{scene.details}</p>
                  </div>
                </>
              )}

              {/* Performers */}
              {scene.performers && scene.performers.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Performers</h3>
                    <div className="flex flex-wrap gap-2">
                      {scene.performers.map((performer: any, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {performer.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Tags */}
              {scene.tags && scene.tags.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {scene.tags.map((tag: any, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              {scene.urls && scene.urls.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Links</h3>
                    <div className="space-y-1">
                      {scene.urls.map((url: string, idx: number) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {!subscriptionStatus?.isSubscribed && (
                <Button onClick={() => onSubscribe(scene)}>
                  Subscribe
                </Button>
              )}
              {subscriptionStatus?.isSubscribed && subscriptionStatus.subscription && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>
                    Subscribed with {subscriptionStatus.subscription.qualityProfile?.name || 'profile'}
                    {subscriptionStatus.subscription.autoDownload && ' - Auto Download'}
                  </span>
                </div>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Scene not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
