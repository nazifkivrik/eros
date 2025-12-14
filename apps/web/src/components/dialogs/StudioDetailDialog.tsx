"use client";

import { useStudioDetails } from "@/hooks/useSearch";
import { useCheckSubscription } from "@/hooks/useSubscriptions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Check } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { SubscriptionFooter } from "./SubscriptionFooter";

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
              <ImageCarousel
                images={studio.images || []}
                alt={studio.name}
                aspectRatio="video"
              />

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

            <SubscriptionFooter
              isSubscribed={subscriptionStatus?.isSubscribed || false}
              subscription={subscriptionStatus?.subscription}
              onClose={onClose}
              onSubscribe={() => onSubscribe(studio)}
            />
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
