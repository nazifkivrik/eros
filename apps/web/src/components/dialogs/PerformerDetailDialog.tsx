"use client";

import { usePerformerDetails } from "@/hooks/useSearch";
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
import { Calendar, MapPin, Users, Check } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { SubscriptionFooter } from "./SubscriptionFooter";
import { formatDate } from "@/lib/dialog-utils";

interface PerformerDetailDialogProps {
  performerId: string | null;
  onClose: () => void;
  onSubscribe: (performer: any) => void;
}

export function PerformerDetailDialog({
  performerId,
  onClose,
  onSubscribe,
}: PerformerDetailDialogProps) {
  const { data: performer, isLoading } = usePerformerDetails(
    performerId || ""
  );

  const { data: subscriptionStatus, isLoading: isCheckingSubscription } =
    useCheckSubscription("performer", performerId || "");

  return (
    <Dialog open={!!performerId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isLoading ? "Loading..." : performer?.name || "Performer Details"}
            {!isCheckingSubscription && subscriptionStatus?.isSubscribed && (
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

                {(performer.careerStartDate || performer.careerEndDate) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Career:{" "}
                      {performer.careerStartDate
                        ? new Date(performer.careerStartDate).getFullYear()
                        : "?"}
                      {" - "}
                      {performer.careerEndDate
                        ? new Date(performer.careerEndDate).getFullYear()
                        : "Present"}
                    </span>
                  </div>
                )}

                {performer.careerLength && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Career Length</h3>
                    <p className="text-sm mt-1">{performer.careerLength}</p>
                  </div>
                )}

                {performer.measurements && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Measurements</h3>
                    <p className="text-sm mt-1">{performer.measurements}</p>
                  </div>
                )}

                {performer.tattoos && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Tattoos</h3>
                    <p className="text-sm mt-1">{performer.tattoos}</p>
                  </div>
                )}

                {performer.piercings && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Piercings</h3>
                    <p className="text-sm mt-1">{performer.piercings}</p>
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
              isSubscribed={subscriptionStatus?.isSubscribed || false}
              subscription={subscriptionStatus?.subscription}
              onClose={onClose}
              onSubscribe={() => onSubscribe(performer)}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Performer not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
