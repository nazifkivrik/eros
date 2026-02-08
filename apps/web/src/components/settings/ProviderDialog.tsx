"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  useAddMetadataProvider,
  useAddIndexerProvider,
  useAddTorrentClientProvider,
  useUpdateMetadataProvider,
  useUpdateIndexerProvider,
  useUpdateTorrentClientProvider,
} from "@/features/settings/hooks";
import type {
  MetadataProviderConfig,
  IndexerProviderConfig,
  TorrentClientConfig,
} from "@repo/shared-types";

type ProviderType = "metadata" | "indexer" | "torrentClient";
type ProviderDialogMode = "add" | "edit";

interface ProviderDialogProps {
  open: boolean;
  mode: ProviderDialogMode;
  type: ProviderType;
  provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig | null;
  onClose: () => void;
}

const metadataTypes = [
  { value: "tpdb", label: "ThePornDB (TPDB)" },
  { value: "stashdb", label: "StashDB" },
] as const;

const indexerTypes = [
  { value: "prowlarr", label: "Prowlarr" },
  { value: "jackett", label: "Jackett" },
] as const;

const torrentClientTypes = [
  { value: "qbittorrent", label: "qBittorrent" },
  { value: "transmission", label: "Transmission" },
] as const;

interface FormData {
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
  // Metadata fields
  apiUrl?: string;
  apiKey?: string;
  // Indexer fields
  baseUrl?: string;
  // Torrent client fields
  url?: string;
  username?: string;
  password?: string;
}

/**
 * ProviderDialog - Dialog for adding/editing providers
 */
export function ProviderDialog({
  open,
  mode,
  type,
  provider,
  onClose,
}: ProviderDialogProps) {
  const [form, setForm] = useState<FormData>({
    name: "",
    type: "",
    enabled: true,
    priority: 1,
  });

  const addMetadataProvider = useAddMetadataProvider();
  const addIndexerProvider = useAddIndexerProvider();
  const addTorrentClientProvider = useAddTorrentClientProvider();

  const updateMetadataProvider = useUpdateMetadataProvider();
  const updateIndexerProvider = useUpdateIndexerProvider();
  const updateTorrentClientProvider = useUpdateTorrentClientProvider();

  const isPending =
    addMetadataProvider.isPending ||
    addIndexerProvider.isPending ||
    addTorrentClientProvider.isPending ||
    updateMetadataProvider.isPending ||
    updateIndexerProvider.isPending ||
    updateTorrentClientProvider.isPending;

  useEffect(() => {
    if (provider) {
      setForm({
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        priority: provider.priority,
        ...(provider as MetadataProviderConfig).apiUrl !== undefined && {
          apiUrl: (provider as MetadataProviderConfig).apiUrl,
        },
        ...(provider as MetadataProviderConfig).apiKey !== undefined && {
          apiKey: (provider as MetadataProviderConfig).apiKey,
        },
        ...(provider as IndexerProviderConfig).baseUrl !== undefined && {
          baseUrl: (provider as IndexerProviderConfig).baseUrl,
        },
        ...(provider as IndexerProviderConfig).apiKey !== undefined && {
          apiKey: (provider as IndexerProviderConfig).apiKey,
        },
        ...(provider as TorrentClientConfig).url !== undefined && {
          url: (provider as TorrentClientConfig).url,
        },
        ...(provider as TorrentClientConfig).username !== undefined && {
          username: (provider as TorrentClientConfig).username,
        },
        ...(provider as TorrentClientConfig).password !== undefined && {
          password: (provider as TorrentClientConfig).password,
        },
      });
    } else {
      setForm({
        name: "",
        type: type === "metadata" ? "tpdb" : type === "indexer" ? "prowlarr" : "qbittorrent",
        enabled: true,
        priority: 1,
      });
    }
  }, [provider, type, open]);

  const handleSubmit = () => {
    // Validate form
    if (!form.name.trim()) {
      return;
    }

    const baseData = {
      name: form.name,
      type: form.type as any,
      enabled: form.enabled,
      priority: form.priority,
    };

    if (mode === "add") {
      switch (type) {
        case "metadata":
          addMetadataProvider.mutate({
            ...baseData,
            type: form.type as "tpdb" | "stashdb",
            apiUrl: form.apiUrl || "",
            apiKey: form.apiKey || "",
          });
          break;
        case "indexer":
          addIndexerProvider.mutate({
            ...baseData,
            type: form.type as "prowlarr" | "jackett",
            baseUrl: form.baseUrl || "",
            apiKey: form.apiKey || "",
          });
          break;
        case "torrentClient":
          addTorrentClientProvider.mutate({
            ...baseData,
            type: form.type as "qbittorrent" | "transmission",
            url: form.url || "",
            username: form.username,
            password: form.password,
          });
          break;
      }
    } else {
      // Update mode
      switch (type) {
        case "metadata":
          updateMetadataProvider.mutate({
            id: provider!.id,
            updates: {
              name: form.name,
              enabled: form.enabled,
              priority: form.priority,
              apiUrl: form.apiUrl || "",
              apiKey: form.apiKey || "",
            },
          });
          break;
        case "indexer":
          updateIndexerProvider.mutate({
            id: provider!.id,
            updates: {
              name: form.name,
              enabled: form.enabled,
              priority: form.priority,
              baseUrl: form.baseUrl || "",
              apiKey: form.apiKey || "",
            },
          });
          break;
        case "torrentClient":
          updateTorrentClientProvider.mutate({
            id: provider!.id,
            updates: {
              name: form.name,
              enabled: form.enabled,
              priority: form.priority,
              url: form.url || "",
              username: form.username,
              password: form.password,
            },
          });
          break;
      }
    }

    if (!isPending) {
      onClose();
    }
  };

  const getTypeOptions = () => {
    switch (type) {
      case "metadata":
        return metadataTypes;
      case "indexer":
        return indexerTypes;
      case "torrentClient":
        return torrentClientTypes;
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Provider" : "Edit Provider"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Main TPDB"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="provider-type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(value) => setForm({ ...form, type: value })}
              disabled={mode === "edit"}
            >
              <SelectTrigger id="provider-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getTypeOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="provider-priority">Priority</Label>
            <Input
              id="provider-priority"
              type="number"
              min="1"
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: parseInt(e.target.value) || 1 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Lower number = higher priority (tried first)
            </p>
          </div>

          {/* Type-specific fields */}
          {type === "metadata" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="api-url">API URL</Label>
                <Input
                  id="api-url"
                  value={form.apiUrl || ""}
                  onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                  placeholder={
                    form.type === "tpdb"
                      ? "https://api.theporndb.net"
                      : "https://stashdb.org/graphql"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={form.apiKey || ""}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="Enter API key"
                />
              </div>
            </>
          )}

          {type === "indexer" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  value={form.baseUrl || ""}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="http://localhost:9696"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={form.apiKey || ""}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="Enter API key"
                />
              </div>
            </>
          )}

          {type === "torrentClient" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-url">URL</Label>
                <Input
                  id="client-url"
                  value={form.url || ""}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="http://localhost:8080"
                />
              </div>
              {form.type === "qbittorrent" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={form.username || ""}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      placeholder="admin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password || ""}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder="Enter password"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <Switch
              id="enabled"
              checked={form.enabled}
              onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : mode === "add" ? (
              "Add"
            ) : (
              "Update"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
