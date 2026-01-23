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
  const [deleteAssociatedScenes, setDeleteAssociatedScenes] = useState(true);

  const handleConfirm = () => {
    onConfirm(deleteAssociatedScenes);
    setDeleteAssociatedScenes(true);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const getDescription = () => {
    if (entityType === "scene") {
      return `Are you sure you want to unsubscribe from this scene? The scene and its files will be removed from your library and deleted from disk.`;
    }

    if (deleteAssociatedScenes) {
      return `Are you sure you want to unsubscribe from ${entityName}? This will remove the ${entityType} subscription and delete all associated scene folders from your disk. This action cannot be undone.`;
    }

    return `Are you sure you want to unsubscribe from ${entityName}? This will remove the ${entityType} subscription from your library.`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsubscribe from {entityName}?</DialogTitle>
          <DialogDescription className="space-y-4">
            <div className="pt-2">{getDescription()}</div>

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
                    Also remove associated scenes and delete their files
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove all scenes discovered from this {entityType} and permanently delete their folders from disk.
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
