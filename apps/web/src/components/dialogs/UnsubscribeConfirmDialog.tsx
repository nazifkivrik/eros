"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface UnsubscribeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "performer" | "studio" | "scene";
  entityName: string;
  onConfirm: (deleteAssociatedScenes: boolean) => void;
}

export function UnsubscribeConfirmDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  onConfirm,
}: UnsubscribeConfirmDialogProps) {
  const [deleteAssociatedScenes, setDeleteAssociatedScenes] = useState(true); // Default true for performer/studio

  const handleConfirm = () => {
    onConfirm(deleteAssociatedScenes);
    setDeleteAssociatedScenes(true); // Reset for next time
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const getDescription = () => {
    if (entityType === "scene") {
      return `Are you sure you want to unsubscribe from this scene? The scene and its files will be removed from your library.`;
    }

    return `Are you sure you want to unsubscribe from ${entityName}? This will remove the ${entityType} subscription from your library.`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsubscribe from {entityName}?</DialogTitle>
          <DialogDescription className="space-y-4">
            <p className="pt-2">{getDescription()}</p>

            {/* Show deleteAssociatedScenes option only for performer/studio */}
            {(entityType === "performer" || entityType === "studio") && (
              <div className="flex items-start space-x-3 rounded-lg border p-4 bg-muted/50">
                <Checkbox
                  id="deleteAssociatedScenes"
                  checked={deleteAssociatedScenes}
                  onCheckedChange={(checked) => setDeleteAssociatedScenes(checked === true)}
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="deleteAssociatedScenes"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Also remove associated scenes
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove all scenes that were discovered from this {entityType}.
                    Scenes subscribed through other sources will be kept.
                  </p>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
          >
            Unsubscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
