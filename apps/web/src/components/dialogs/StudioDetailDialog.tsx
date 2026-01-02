"use client";

import { useState } from "react";
import type { Studio } from "@repo/shared-types";
import { useStudioDetails } from "@/hooks/useSearch";
import { useCheckSubscription, useDeleteSubscription } from "@/hooks/useSubscriptions";
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
import { UnsubscribeConfirmDialog } from "./UnsubscribeConfirmDialog";

interface StudioDetailDialogProps {
  studioId: string | null;
  onClose: () => void;
  onSubscribe: (studio: Studio) => void;
}

export function StudioDetailDialog({
  studioId,
  onClose,
  onSubscribe,
}: StudioDetailDialogProps) {
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);

  const { data: studio, isLoading } = useStudioDetails(studioId || "");

  const { data: subscriptionStatus, isLoading: isCheckingSubscription } =
    useCheckSubscription("studio", studioId || "");

  const deleteSubscription = useDeleteSubscription();

  const handleUnsubscribe = (deleteAssociatedScenes: boolean, removeFiles: boolean) => {
    if (subscriptionStatus?.subscription?.id) {
      deleteSubscription.mutate({
        id: subscriptionStatus.subscription.id,
        deleteAssociatedScenes,
        removeFiles,
      });
    }
  };

  return (
    <Dialog open={!!studioId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isLoading ? "Loading..." : studio?.name || "Studio Details"}
            {!isCheckingSubscription && subscriptionStatus?.subscribed && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Subscribed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading studio details"
              : studio?.description || "Studio details and information"}
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
              <div className="space-y-4">
                {studio.description && (
                  <div className="text-sm text-muted-foreground">
                    {studio.description}
                  </div>
                )}

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
                    <span className="text-muted-foreground">Parent Studio ID: </span>
                    <span className="font-medium">{studio.parentStudioId}</span>
                  </div>
                )}

                {studio.networkId && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Network ID: </span>
                    <span className="font-medium">{studio.networkId}</span>
                  </div>
                )}
              </div>
            </div>

            <SubscriptionFooter
              isSubscribed={subscriptionStatus?.subscribed || false}
              subscription={subscriptionStatus?.subscription ?? undefined}
              onClose={onClose}
              onSubscribe={() => onSubscribe(studio)}
              onUnsubscribe={() => setShowUnsubscribeDialog(true)}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Studio not found
          </div>
        )}
      </DialogContent>

      <UnsubscribeConfirmDialog
        open={showUnsubscribeDialog}
        onOpenChange={setShowUnsubscribeDialog}
        entityType="studio"
        entityName={studio?.name || "this studio"}
        onConfirm={handleUnsubscribe}
      />
    </Dialog>
  );
}
