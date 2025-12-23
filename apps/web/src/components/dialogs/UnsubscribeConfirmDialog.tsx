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
  onConfirm: (deleteAssociatedScenes: boolean, removeFiles: boolean) => void;
}

export function UnsubscribeConfirmDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  onConfirm,
}: UnsubscribeConfirmDialogProps) {
  const [deleteAssociatedScenes, setDeleteAssociatedScenes] = useState(true); // Default true for performer/studio
  const [removeFiles, setRemoveFiles] = useState(false);

  const handleConfirm = () => {
    onConfirm(deleteAssociatedScenes, removeFiles);
    setDeleteAssociatedScenes(true); // Reset for next time
    setRemoveFiles(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setRemoveFiles(false); // Reset
    onOpenChange(false);
  };

  const getDescription = () => {
    if (entityType === "scene") {
      return `Are you sure you want to unsubscribe from this scene? This will remove the subscription from your library.`;
    }

    return `Are you sure you want to unsubscribe from ${entityName}? This will remove all scene subscriptions associated with this ${entityType}.`;
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
                    Also delete associated scene subscriptions
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove all scene subscriptions that were created from this {entityType}.
                    Scenes subscribed through other {entityType === "performer" ? "performers or studios" : "studios or performers"} will be kept.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3 rounded-lg border p-4 bg-muted/50">
              <Checkbox
                id="removeFiles"
                checked={removeFiles}
                onCheckedChange={(checked) => setRemoveFiles(checked === true)}
                disabled={entityType !== "scene" && !deleteAssociatedScenes}
              />
              <div className="space-y-1 leading-none">
                <Label
                  htmlFor="removeFiles"
                  className={`text-sm font-medium cursor-pointer ${entityType !== "scene" && !deleteAssociatedScenes ? "opacity-50" : ""}`}
                >
                  Remove downloaded files and folders
                </Label>
                <p className="text-sm text-muted-foreground">
                  {entityType === "scene"
                    ? "This will permanently delete the scene folder and all downloaded files."
                    : `Delete scene folders and files only if they are not subscribed through other ${entityType === "performer" ? "performers or studios" : "studios or performers"}.`}
                </p>
              </div>
            </div>
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
