"use client";

import { useState } from "react";
import type { Performer } from "@repo/shared-types";
import { usePerformerDetails } from "@/features/search";
import { useCheckSubscription, useDeleteSubscription } from "@/features/subscriptions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, Check } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { SubscriptionFooter } from "./SubscriptionFooter";
import { UnsubscribeConfirmDialog } from "./UnsubscribeConfirmDialog";
import { formatDate } from "@/lib/dialog-utils";

interface PerformerDetailDialogProps {
  performerId: string | null;
  onClose: () => void;
  onSubscribe: (performer: Performer) => void;
}

export function PerformerDetailDialog({
  performerId,
  onClose,
  onSubscribe,
}: PerformerDetailDialogProps) {
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);

  const { data: performer, isLoading } = usePerformerDetails(
    performerId || ""
  );

  const { data: subscriptionStatus, isLoading: isCheckingSubscription } =
    useCheckSubscription("performer", performerId || "");

  const deleteSubscription = useDeleteSubscription();

  const handleUnsubscribe = (deleteAssociatedScenes: boolean) => {
    if (subscriptionStatus?.subscription?.id) {
      deleteSubscription.mutate({
        id: subscriptionStatus.subscription.id,
        deleteAssociatedScenes,
        removeFiles: deleteAssociatedScenes, // Always delete files when deleting scenes
      });
    }
  };

  return (
    <Dialog open={!!performerId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isLoading ? "Loading..." : performer?.name || "Performer Details"}
            {!isCheckingSubscription && subscriptionStatus?.subscribed && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Subscribed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading performer details"
              : performer?.disambiguation || "Performer details and information"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : performer ? (
          <>

            <div className="space-x-6 flex flex-row items-center justify-center">
              <ImageCarousel
                images={performer.images || []}
                alt={performer.name}
                aspectRatio="portrait"
                className="w-1/2 mx-auto"
              />

              {/* Info */}
              <div className="space-y-4 flex-1">
                {performer.gender && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">{performer.gender}</span>
                  </div>
                )}

                {performer.birthdate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Born: {formatDate(performer.birthdate)}</span>
                  </div>
                )}

                {performer.birthplace && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{performer.birthplace}</span>
                  </div>
                )}

                {(performer.careerStartYear || performer.careerEndYear) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Career: </span>
                    <span className="font-medium">
                      {performer.careerStartYear || "?"}
                      {" - "}
                      {performer.careerEndYear || "Present"}
                    </span>
                  </div>
                )}

                {(performer.ethnicity || performer.nationality) && (
                  <div className="text-sm">
                    {performer.ethnicity && (
                      <>
                        <span className="text-muted-foreground">Ethnicity: </span>
                        <span className="font-medium">{performer.ethnicity}</span>
                      </>
                    )}
                    {performer.ethnicity && performer.nationality && <span className="mx-2">•</span>}
                    {performer.nationality && (
                      <>
                        <span className="text-muted-foreground">Nationality: </span>
                        <span className="font-medium">{performer.nationality}</span>
                      </>
                    )}
                  </div>
                )}

                {(performer.hairColour || performer.eyeColour) && (
                  <div className="text-sm">
                    {performer.hairColour && (
                      <>
                        <span className="text-muted-foreground">Hair: </span>
                        <span className="font-medium capitalize">{performer.hairColour}</span>
                      </>
                    )}
                    {performer.hairColour && performer.eyeColour && <span className="mx-2">•</span>}
                    {performer.eyeColour && (
                      <>
                        <span className="text-muted-foreground">Eyes: </span>
                        <span className="font-medium capitalize">{performer.eyeColour}</span>
                      </>
                    )}
                  </div>
                )}

                {(performer.height || performer.weight) && (
                  <div className="text-sm">
                    {performer.height && (
                      <>
                        <span className="text-muted-foreground">Height: </span>
                        <span className="font-medium">{performer.height} cm</span>
                      </>
                    )}
                    {performer.height && performer.weight && <span className="mx-2">•</span>}
                    {performer.weight && (
                      <>
                        <span className="text-muted-foreground">Weight: </span>
                        <span className="font-medium">{performer.weight} kg</span>
                      </>
                    )}
                  </div>
                )}

                {performer.measurements && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Measurements: </span>
                    <span className="font-medium">{performer.measurements}</span>
                    {performer.cupsize && <span className="font-medium"> ({performer.cupsize})</span>}
                  </div>
                )}

                {performer.tattoos && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tattoos: </span>
                    <span className="font-medium">{performer.tattoos}</span>
                  </div>
                )}

                {performer.piercings && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Piercings: </span>
                    <span className="font-medium">{performer.piercings}</span>
                  </div>
                )}

                {performer.aliases && performer.aliases.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Aliases</h3>
                    <div className="flex flex-wrap gap-2">
                      {performer.aliases.map((alias: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Biography */}
            {performer.bio && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Biography</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{performer.bio}</p>
              </div>
            )}

            <SubscriptionFooter
              isSubscribed={subscriptionStatus?.subscribed || false}
              subscription={subscriptionStatus?.subscription ?? undefined}
              onClose={onClose}
              onSubscribe={() => onSubscribe(performer)}
              onUnsubscribe={() => setShowUnsubscribeDialog(true)}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Performer not found
          </div>
        )}
      </DialogContent>

      <UnsubscribeConfirmDialog
        open={showUnsubscribeDialog}
        onOpenChange={setShowUnsubscribeDialog}
        entityType="performer"
        entityName={performer?.name || "this performer"}
        onConfirm={handleUnsubscribe}
      />
    </Dialog>
  );
}
