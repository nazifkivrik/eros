"use client";

import { useState } from "react";
import type { Scene } from "@repo/shared-types";
import { useSceneDetails } from "@/hooks/useSearch";
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
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Film, Link as LinkIcon, Check } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { SubscriptionFooter } from "./SubscriptionFooter";
import { UnsubscribeConfirmDialog } from "./UnsubscribeConfirmDialog";
import { formatDate, formatDuration } from "@/lib/dialog-utils";

interface SceneDetailDialogProps {
  sceneId: string | null;
  onClose: () => void;
  onSubscribe: (scene: Scene) => void;
}

export function SceneDetailDialog({
  sceneId,
  onClose,
  onSubscribe,
}: SceneDetailDialogProps) {
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);

  const { data: scene, isLoading } = useSceneDetails(sceneId || "");

  const { data: subscriptionStatus, isLoading: isCheckingSubscription } =
    useCheckSubscription("scene", sceneId || "");

  const deleteSubscription = useDeleteSubscription();

  const handleUnsubscribe = (deleteAssociatedScenes: boolean, removeFiles: boolean) => {
    if (subscriptionStatus?.subscription?.id) {
      deleteSubscription.mutate({
        id: subscriptionStatus.subscription.id,
        deleteAssociatedScenes: deleteAssociatedScenes, // Scene is standalone, but keep parameter for consistency
        removeFiles,
      });
    }
  };

  return (
    <Dialog open={!!sceneId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isLoading ? "Loading..." : scene?.title || "Scene Details"}
            {!isCheckingSubscription && subscriptionStatus?.subscribed && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Subscribed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Loading scene details"
              : scene?.date
                ? formatDate(scene.date)
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
              <ImageCarousel
                images={scene.images || []}
                alt={scene.title}
                aspectRatio="video"
              />

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

                {scene.siteId && (
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Site ID: {scene.siteId}</span>
                  </div>
                )}

                {scene.code && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Code: </span>
                    <span className="font-medium">{scene.code}</span>
                  </div>
                )}
              </div>

              {scene.directorIds && scene.directorIds.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Directors: </span>
                  <span className="font-medium">{scene.directorIds.length} director(s)</span>
                </div>
              )}

              {scene.description && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground">{scene.description}</p>
                  </div>
                </>
              )}

              {/* Files */}
              {(scene as any).files && (scene as any).files.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Downloaded Files ({(scene as any).files.length})</h3>
                    <div className="space-y-2">
                      {(scene as any).files.map((file: any) => (
                        <div key={file.id} className="text-sm bg-muted/50 p-3 rounded-md">
                          <div className="font-mono text-xs break-all">{file.filePath}</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {(file.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Link */}
              {scene.url && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Link</h3>
                    <a
                      href={scene.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <LinkIcon className="h-3 w-3" />
                      {scene.url}
                    </a>
                  </div>
                </>
              )}
            </div>

            <SubscriptionFooter
              isSubscribed={subscriptionStatus?.subscribed || false}
              subscription={subscriptionStatus?.subscription ?? undefined}
              onClose={onClose}
              onSubscribe={() => onSubscribe(scene)}
              onUnsubscribe={() => setShowUnsubscribeDialog(true)}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Scene not found
          </div>
        )}
      </DialogContent>

      <UnsubscribeConfirmDialog
        open={showUnsubscribeDialog}
        onOpenChange={setShowUnsubscribeDialog}
        entityType="scene"
        entityName={scene?.title || "this scene"}
        onConfirm={handleUnsubscribe}
      />
    </Dialog>
  );
}
