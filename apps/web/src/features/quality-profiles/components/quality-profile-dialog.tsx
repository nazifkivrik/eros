"use client";

import { useState, type FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QualityProfile, QualityItem } from "@repo/shared-types";

const QUALITY_OPTIONS = [
  { value: "2160p", label: "2160p (4K)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "720p", label: "720p (HD)" },
  { value: "480p", label: "480p (SD)" },
  { value: "any", label: "Any Quality" },
];

const SOURCE_OPTIONS = [
  { value: "bluray", label: "Blu-ray" },
  { value: "webdl", label: "WEB-DL" },
  { value: "webrip", label: "WEBRip" },
  { value: "hdtv", label: "HDTV" },
  { value: "dvd", label: "DVD" },
  { value: "any", label: "Any Source" },
];

export interface QualityProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: QualityProfile | null;
  onSubmit: (data: { name: string; items: QualityItem[] }) => Promise<void>;
  isPending: boolean;
}

export const QualityProfileDialog: FC<QualityProfileDialogProps> = ({
  open,
  onOpenChange,
  profile,
  onSubmit,
  isPending,
}) => {
  const [name, setName] = useState(profile?.name || "");
  const [items, setItems] = useState<QualityItem[]>(profile?.items || []);
  const [error, setError] = useState("");

  // Form state for adding new item
  const [newItem, setNewItem] = useState<{
    quality: string;
    source: string;
    minSeeders: number | "any";
    maxSize: number;
  }>({
    quality: "1080p",
    source: "webdl",
    minSeeders: 0,
    maxSize: 0,
  });

  const handleAddItem = () => {
    if (!newItem.quality || !newItem.source) {
      setError("Please select both quality and source");
      return;
    }

    // Check for duplicates
    const isDuplicate = items.some(
      (item) =>
        item.quality === newItem.quality && item.source === newItem.source
    );
    if (isDuplicate) {
      setError("This quality and source combination already exists");
      return;
    }

    setItems((prev) => [...prev, { ...newItem } as QualityItem]);
    setError("");

    // Reset form
    setNewItem({
      quality: "1080p",
      source: "webdl",
      minSeeders: 0,
      maxSize: 0,
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Profile name is required");
      return;
    }

    if (items.length === 0) {
      setError("At least one quality item is required");
      return;
    }

    try {
      await onSubmit({ name: name.trim(), items });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {profile ? "Edit Quality Profile" : "Create Quality Profile"}
          </DialogTitle>
          <DialogDescription>
            Add quality and source combinations. The system will automatically
            sort them from best to worst quality.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Profile Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., HD Quality"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Quality Items</Label>
              <Badge variant="secondary">
                {items.length} {items.length === 1 ? "item" : "items"}
              </Badge>
            </div>

            {items.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>
                    Current Order (Auto-sorted: Best → Worst)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-secondary p-3 rounded-md"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {QUALITY_OPTIONS.find((q) => q.value === item.quality)
                            ?.label || item.quality}{" "}
                          •{" "}
                          {SOURCE_OPTIONS.find((s) => s.value === item.source)
                            ?.label || item.source}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Min Seeds:{" "}
                          {item.minSeeders === "any" ? "Any" : item.minSeeders} •
                          Max Size:{" "}
                          {item.maxSize === 0 ? "Unlimited" : `${item.maxSize}GB`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add New Quality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quality">Quality</Label>
                    <Select
                      value={newItem.quality}
                      onValueChange={(value) =>
                        setNewItem((prev) => ({ ...prev, quality: value }))
                      }
                    >
                      <SelectTrigger id="quality">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={newItem.source}
                      onValueChange={(value) =>
                        setNewItem((prev) => ({ ...prev, source: value }))
                      }
                    >
                      <SelectTrigger id="source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minSeeders">Min Seeders</Label>
                    <Select
                      value={String(newItem.minSeeders)}
                      onValueChange={(value) =>
                        setNewItem((prev) => ({
                          ...prev,
                          minSeeders: value === "any" ? "any" : parseInt(value),
                        }))
                      }
                    >
                      <SelectTrigger id="minSeeders">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxSize">Max Size (GB, 0 = unlimited)</Label>
                    <Input
                      id="maxSize"
                      type="number"
                      min="0"
                      value={newItem.maxSize}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          maxSize: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full"
                >
                  + Add Quality
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {profile ? "Update Profile" : "Create Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
