"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Loader2,
  Database,
  Server,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useProviders,
  useUpdateMetadataProvider,
  useUpdateIndexerProvider,
  useUpdateTorrentClientProvider,
  useDeleteMetadataProvider,
  useDeleteIndexerProvider,
  useDeleteTorrentClientProvider,
  useTestMetadataProvider,
  useTestIndexerProvider,
  useTestTorrentClientProvider,
} from "@/features/settings/hooks";
import { ProviderDialog } from "./ProviderDialog";
import type { MetadataProviderConfig, IndexerProviderConfig, TorrentClientConfig } from "@repo/shared-types";

type ProviderType = "metadata" | "indexer" | "torrentClient";
type ProviderDialogMode = "add" | "edit";

interface ProviderDialogState {
  open: boolean;
  mode: ProviderDialogMode;
  type: ProviderType | null;
  provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig | null;
}

/**
 * ServicesTab - Multi-provider management for metadata providers, indexers, and torrent clients
 */
export function ServicesTab() {
  const { data: providers, isLoading } = useProviders();

  const updateMetadataProvider = useUpdateMetadataProvider();
  const updateIndexerProvider = useUpdateIndexerProvider();
  const updateTorrentClientProvider = useUpdateTorrentClientProvider();

  const deleteMetadataProvider = useDeleteMetadataProvider();
  const deleteIndexerProvider = useDeleteIndexerProvider();
  const deleteTorrentClientProvider = useDeleteTorrentClientProvider();

  const testMetadataProvider = useTestMetadataProvider();
  const testIndexerProvider = useTestIndexerProvider();
  const testTorrentClientProvider = useTestTorrentClientProvider();

  const [testing, setTesting] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ProviderDialogState>({
    open: false,
    mode: "add",
    type: null,
    provider: null,
  });

  const handleTest = async (type: ProviderType, id: string) => {
    setTesting(id);

    let testFn;
    switch (type) {
      case "metadata":
        testFn = testMetadataProvider;
        break;
      case "indexer":
        testFn = testIndexerProvider;
        break;
      case "torrentClient":
        testFn = testTorrentClientProvider;
        break;
    }

    await testFn.mutateAsync(id);
    setTesting(null);
  };

  const handleToggleEnabled = (
    type: ProviderType,
    provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig
  ) => {
    let updateFn;
    switch (type) {
      case "metadata":
        updateFn = updateMetadataProvider;
        break;
      case "indexer":
        updateFn = updateIndexerProvider;
        break;
      case "torrentClient":
        updateFn = updateTorrentClientProvider;
        break;
    }

    updateFn.mutate({
      id: provider.id,
      updates: { enabled: !provider.enabled },
    });
  };

  const handleDelete = (
    type: ProviderType,
    id: string
  ) => {
    let deleteFn;
    switch (type) {
      case "metadata":
        deleteFn = deleteMetadataProvider;
        break;
      case "indexer":
        deleteFn = deleteIndexerProvider;
        break;
      case "torrentClient":
        deleteFn = deleteTorrentClientProvider;
        break;
    }

    if (confirm("Are you sure you want to delete this provider?")) {
      deleteFn.mutate(id);
    }
  };

  const handleAdd = (type: ProviderType) => {
    setDialog({
      open: true,
      mode: "add",
      type,
      provider: null,
    });
  };

  const handleEdit = (
    type: ProviderType,
    provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig
  ) => {
    setDialog({
      open: true,
      mode: "edit",
      type,
      provider,
    });
  };

  const handleDialogClose = () => {
    setDialog({
      open: false,
      mode: "add",
      type: null,
      provider: null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Metadata Providers Section */}
      <ProviderSection
        title="Metadata Providers"
        description="Configure multiple metadata sources (TPDB, StashDB)"
        icon={<Database className="h-5 w-5" />}
        providers={providers?.metadata || []}
        onAdd={() => handleAdd("metadata")}
        onEdit={(provider) => handleEdit("metadata", provider)}
        onDelete={(id) => handleDelete("metadata", id)}
        onTest={(id) => handleTest("metadata", id)}
        onToggle={(provider) => handleToggleEnabled("metadata", provider)}
        testing={testing}
      />

      {/* Indexers Section */}
      <ProviderSection
        title="Indexer Services"
        description="Configure torrent indexers (Prowlarr, Jackett)"
        icon={<Server className="h-5 w-5" />}
        providers={providers?.indexers || []}
        onAdd={() => handleAdd("indexer")}
        onEdit={(provider) => handleEdit("indexer", provider)}
        onDelete={(id) => handleDelete("indexer", id)}
        onTest={(id) => handleTest("indexer", id)}
        onToggle={(provider) => handleToggleEnabled("indexer", provider)}
        testing={testing}
      />

      {/* Torrent Clients Section */}
      <ProviderSection
        title="Torrent Clients"
        description="Configure download clients (qBittorrent, Transmission)"
        icon={<Download className="h-5 w-5" />}
        providers={providers?.torrentClients || []}
        onAdd={() => handleAdd("torrentClient")}
        onEdit={(provider) => handleEdit("torrentClient", provider)}
        onDelete={(id) => handleDelete("torrentClient", id)}
        onTest={(id) => handleTest("torrentClient", id)}
        onToggle={(provider) => handleToggleEnabled("torrentClient", provider)}
        testing={testing}
      />

      {/* Provider Dialog */}
      <ProviderDialog
        open={dialog.open}
        mode={dialog.mode}
        type={dialog.type!}
        provider={dialog.provider}
        onClose={handleDialogClose}
      />
    </div>
  );
}

interface ProviderSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  providers: Array<MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig>;
  onAdd: () => void;
  onEdit: (provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onToggle: (provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig) => void;
  testing: string | null;
}

function ProviderSection({
  title,
  description,
  icon,
  providers,
  onAdd,
  onEdit,
  onDelete,
  onTest,
  onToggle,
  testing,
}: ProviderSectionProps) {
  // Sort providers by priority
  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <div className="space-y-3">
        {sortedProviders.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onEdit={() => onEdit(provider)}
            onDelete={() => onDelete(provider.id)}
            onTest={() => onTest(provider.id)}
            onToggle={() => onToggle(provider)}
            testing={testing === provider.id}
          />
        ))}
        {sortedProviders.length === 0 && (
          <Card>
            <CardContent className="text-center p-8 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                {icon}
                <p>No providers configured. Click Add to create one.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ProviderCardProps {
  provider: MetadataProviderConfig | IndexerProviderConfig | TorrentClientConfig;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onToggle: () => void;
  testing: boolean;
}

function ProviderCard({ provider, onEdit, onDelete, onTest, onToggle, testing }: ProviderCardProps) {
  const getUrl = () => {
    if ("apiUrl" in provider) return provider.apiUrl;
    if ("baseUrl" in provider) return provider.baseUrl;
    if ("url" in provider) return provider.url;
    return "";
  };

  return (
    <Card className={provider.enabled ? "" : "opacity-60"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline">Priority {provider.priority}</Badge>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {provider.name}
                {!provider.enabled && (
                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {provider.type.toUpperCase()} • {getUrl()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={provider.enabled}
              onCheckedChange={onToggle}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={onTest}
              disabled={testing || !provider.enabled}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
