"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { DownloadPath, DownloadPathsSettings } from "@repo/shared-types";

interface DownloadPathsSectionProps {
  settings: DownloadPathsSettings;
  onChange: (settings: DownloadPathsSettings) => void;
}

export function DownloadPathsSection({ settings, onChange }: DownloadPathsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<DownloadPath | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    path: string;
    priority: number;
    isDefault: boolean;
  }>({
    name: "",
    path: "",
    priority: 0,
    isDefault: false,
  });
  const [spaceInfo, setSpaceInfo] = useState<Map<string, { free: number; total: number; freePercent: number }>>(new Map());

  // Fetch disk space for all paths on mount and when paths change
  useEffect(() => {
    const fetchSpaceInfo = async () => {
      const newSpaceInfo = new Map<string, { free: number; total: number; freePercent: number }>();

      for (const path of settings.paths) {
        try {
          const response = await fetch("/api/settings/download-paths/check-space", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: path.path }),
          });

          if (response.ok) {
            const info = await response.json();
            newSpaceInfo.set(path.id, {
              free: info.free,
              total: info.total,
              freePercent: info.freePercent,
            });
          }
        } catch (error) {
          console.error(`Failed to check space for ${path.path}:`, error);
        }
      }

      setSpaceInfo(newSpaceInfo);
    };

    fetchSpaceInfo();
    // Poll every 30 seconds
    const interval = setInterval(fetchSpaceInfo, 30000);
    return () => clearInterval(interval);
  }, [settings.paths]);

  const handleOpenAddDialog = () => {
    setEditingPath(null);
    setFormData({
      name: "",
      path: "",
      priority: settings.paths.length,
      isDefault: settings.paths.length === 0,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (path: DownloadPath) => {
    setEditingPath(path);
    setFormData({
      name: path.name,
      path: path.path,
      priority: path.priority,
      isDefault: path.isDefault || false,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.path.trim()) {
      return;
    }

    let updatedPaths: DownloadPath[];

    if (editingPath) {
      // Update existing path
      updatedPaths = settings.paths.map((p) =>
        p.id === editingPath.id
          ? { ...p, name: formData.name.trim(), path: formData.path.trim(), priority: formData.priority, isDefault: formData.isDefault }
          : p
      );
    } else {
      // Add new path
      const newPath: DownloadPath = {
        id: `path-${Date.now()}`,
        name: formData.name.trim(),
        path: formData.path.trim(),
        priority: formData.priority,
        isDefault: formData.isDefault,
      };
      updatedPaths = [...settings.paths, newPath];
    }

    // If setting as default, remove default flag from others
    if (formData.isDefault) {
      updatedPaths = updatedPaths.map((p) =>
        p.id === (editingPath?.id || updatedPaths[updatedPaths.length - 1].id)
          ? { ...p, isDefault: true }
          : { ...p, isDefault: undefined }
      );
    }

    onChange({ ...settings, paths: updatedPaths });
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const updatedPaths = settings.paths.filter((p) => p.id !== id);
    onChange({ ...settings, paths: updatedPaths });
  };

  const handleSetDefault = (id: string) => {
    const updatedPaths = settings.paths.map((p) => ({
      ...p,
      isDefault: p.id === id ? true : undefined,
    }));
    onChange({ ...settings, paths: updatedPaths });
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Download Paths</Label>
          <p className="text-sm text-muted-foreground">
            Configure multiple download locations. torrents will be saved to the path with the most free space.
          </p>
        </div>
        <Button size="sm" onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Add Path
        </Button>
      </div>

      <div className="space-y-2">
        {settings.paths.map((path) => {
          const space = spaceInfo.get(path.id);
          return (
            <div key={path.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <HardDrive className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{path.name}</span>
                  {path.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">{path.path}</div>
                {space && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatBytes(space.free)} free of {formatBytes(space.total)} ({space.freePercent.toFixed(1)}%)
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!path.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetDefault(path.id)}
                    title="Set as default"
                  >
                    Set Default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleOpenEditDialog(path)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(path.id)}
                  disabled={settings.paths.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {settings.paths.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No download paths configured. Add a path to get started.
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPath ? "Edit Path" : "Add Download Path"}</DialogTitle>
            <DialogDescription>
              Configure a Docker volume mount path for downloads. The path must be accessible from within the container.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., SSD Downloads"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="path">Path</Label>
              <Input
                id="path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/mnt/ssd/downloads"
              />
              <p className="text-xs text-muted-foreground">
                Docker volume mount path inside the container
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isDefault">Set as default path</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingPath ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
