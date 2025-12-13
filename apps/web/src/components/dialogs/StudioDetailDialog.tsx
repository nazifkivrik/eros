"use client";

import Image from "next/image";
import { useStudioDetails } from "@/hooks/useSearch";
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
import { Building2, Check } from "lucide-react";

interface StudioDetailDialogProps {
  studioId: string | null;
  onClose: () => void;
  onSubscribe: (studio: any) => void;
}

export function StudioDetailDialog({
  studioId,
  onClose,
  onSubscribe,
}: StudioDetailDialogProps) {
  const { data: studio, isLoading } = useStudioDetails(studioId || "");

  const { data: subscriptionStatus, isLoading: isCheckingSubscription } =
    useCheckSubscription("studio", studioId || "");

  return (
    <Dialog open={!!studioId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isLoading ? "Loading..." : studio?.name || "Studio Details"}
            {!isCheckingSubscription && subscriptionStatus?.isSubscribed && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Subscribed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading studio details"
              : studio?.disambiguation || "Studio details and information"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : studio ? (
          <>

            <div className="space-y-6">
              {/* Images Carousel */}
              {studio.images && studio.images.length > 0 && (
                <Carousel className="w-full">
                  <CarouselContent>
                    {studio.images.map((img: any, idx: number) => (
                      <CarouselItem key={idx}>
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                          <Image
                            src={img.url}
                            alt={`${studio.name} - Image ${idx + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {studio.images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2" />
                      <CarouselNext className="right-2" />
                    </>
                  )}
                </Carousel>
              )}

              {/* Info */}
              <div className="space-y-3">
                {studio.url && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={studio.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {studio.url}
                    </a>
                  </div>
                )}

                {studio.parentStudioId && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Parent Studio: </span>
                    <span className="font-medium">{studio.parentStudioId}</span>
                  </div>
                )}

                {studio.aliases && studio.aliases.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Aliases</h3>
                    <div className="flex flex-wrap gap-2">
                      {studio.aliases.map((alias: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {!subscriptionStatus?.isSubscribed && (
                <Button onClick={() => onSubscribe(studio)}>
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
            Studio not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
