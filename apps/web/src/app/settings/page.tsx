"use client";

import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Save,
  Server,
  Cpu,
  Database,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { QualityProfilesTab } from "@/components/settings/QualityProfilesTab";
import { useSettings, useUpdateSettings, useTestConnection } from "@/hooks/useSettings";
import type { AppSettings } from "@repo/shared-types";
import { DEFAULT_SETTINGS } from "@repo/shared-types";

export default function SettingsPage() {
  const { data: settingsData, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const testConnection = useTestConnection();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("general");

  // Update local state when data is loaded
  useEffect(() => {
    if (settingsData) {
      const data = settingsData as any; // Backend may not have all fields yet
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        general: { ...DEFAULT_SETTINGS.general, ...(data.general || {}) },
        fileManagement: { ...DEFAULT_SETTINGS.fileManagement, ...(data.fileManagement || {}) },
        stashdb: { ...DEFAULT_SETTINGS.stashdb, ...(data.stashdb || {}) },
        tpdb: { ...DEFAULT_SETTINGS.tpdb, ...(data.tpdb || {}) },
        metadata: { ...DEFAULT_SETTINGS.metadata, ...(data.metadata || {}) },
        prowlarr: { ...DEFAULT_SETTINGS.prowlarr, ...(data.prowlarr || {}) },
        qbittorrent: { ...DEFAULT_SETTINGS.qbittorrent, ...(data.qbittorrent || {}) },
        ai: { ...DEFAULT_SETTINGS.ai, ...(data.ai || {}) },
        jobs: { ...DEFAULT_SETTINGS.jobs, ...(data.jobs || {}) },
      });
    }
  }, [settingsData]);

  const handleSave = () => {
    updateSettings.mutate(settings);
  };

  const handleTestConnection = (service: "stashdb" | "tpdb" | "prowlarr" | "qbittorrent") => {
    toast.info(`Testing ${service} connection...`);

    // For TPDB, send current config in the request body
    if (service === "tpdb") {
      testConnection.mutate({
        service,
        config: {
          apiUrl: settings.tpdb.apiUrl,
          apiKey: settings.tpdb.apiKey,
        },
      });
    } else {
      testConnection.mutate({ service });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your Eros installation
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="quality">Quality Profiles</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="prowlarr">Prowlarr</TabsTrigger>
          <TabsTrigger value="qbittorrent">qBittorrent</TabsTrigger>
          <TabsTrigger value="ai">AI Matching</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>Basic application configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">Application Name</Label>
                <Input
                  id="appName"
                  value={settings.general.appName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: { ...settings.general, appName: e.target.value },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="downloadPath">Download Path</Label>
                <Input
                  id="downloadPath"
                  value={settings.general.downloadPath}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: {
                        ...settings.general,
                        downloadPath: e.target.value,
                      },
                    })
                  }
                  placeholder="/path/to/downloads"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableNotifications">
                  Enable Notifications
                </Label>
                <Switch
                  id="enableNotifications"
                  checked={settings.general.enableNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      general: {
                        ...settings.general,
                        enableNotifications: checked,
                      },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minIndexers">
                  Minimum Indexers for Metadata-less Scenes
                </Label>
                <Input
                  id="minIndexers"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.general.minIndexersForMetadataLess}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: {
                        ...settings.general,
                        minIndexersForMetadataLess:
                          parseInt(e.target.value) || 1,
                      },
                    })
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Required number of indexers that must have a scene before it
                  can be downloaded without metadata (default: 2)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupingThreshold">
                  Scene Grouping Threshold
                </Label>
                <Input
                  id="groupingThreshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.general.groupingThreshold ?? 0.7}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      general: {
                        ...settings.general,
                        groupingThreshold: parseFloat(e.target.value) || 0.7,
                      },
                    })
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Threshold for merging truncated scene titles. Higher values are stricter (0.7 = 70% match required, default: 0.7)
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-4">Download Management</h3>

                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoRedownloadDeletedScenes">
                      Auto-Delete Missing Files
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically re-download if files are deleted by user or external apps (Jellyfin, etc.)
                    </p>
                  </div>
                  <Switch
                    id="autoRedownloadDeletedScenes"
                    checked={settings.fileManagement.autoRedownloadDeletedScenes ?? false}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        fileManagement: {
                          ...settings.fileManagement,
                          autoRedownloadDeletedScenes: checked,
                        },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="readdManuallyRemovedTorrents">
                      Re-add Manually Deleted Torrents
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      If torrent is removed from qBittorrent manually, re-add it automatically
                    </p>
                  </div>
                  <Switch
                    id="readdManuallyRemovedTorrents"
                    checked={settings.fileManagement.readdManuallyRemovedTorrents ?? false}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        fileManagement: {
                          ...settings.fileManagement,
                          readdManuallyRemovedTorrents: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Profiles Tab */}
        <TabsContent value="quality" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <QualityProfilesTab />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Settings */}
        <TabsContent value="metadata" className="mt-6">
          <div className="space-y-6">
            {/* Metadata Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Metadata Configuration
                </CardTitle>
                <CardDescription>
                  Configure metadata sources and lookup behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primarySource">Primary Metadata Source</Label>
                  <Select
                    value={settings.metadata.primarySource}
                    onValueChange={(value: "stashdb" | "tpdb") =>
                      setSettings({
                        ...settings,
                        metadata: { ...settings.metadata, primarySource: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tpdb">ThePornDB (TPDB)</SelectItem>
                      <SelectItem value="stashdb">StashDB</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Primary source will be used first for metadata lookups
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableMultiSource">Enable Multi-Source</Label>
                    <p className="text-xs text-muted-foreground">
                      Fall back to secondary source if primary fails
                    </p>
                  </div>
                  <Switch
                    id="enableMultiSource"
                    checked={settings.metadata.enableMultiSource}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        metadata: { ...settings.metadata, enableMultiSource: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="hashLookupEnabled">Enable Hash Lookup</Label>
                    <p className="text-xs text-muted-foreground">
                      Use OSHASH/PHASH for automatic file matching
                    </p>
                  </div>
                  <Switch
                    id="hashLookupEnabled"
                    checked={settings.metadata.hashLookupEnabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        metadata: { ...settings.metadata, hashLookupEnabled: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoLinkOnMatch">Auto-Link on Match</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically link entities when a match is found
                    </p>
                  </div>
                  <Switch
                    id="autoLinkOnMatch"
                    checked={settings.metadata.autoLinkOnMatch}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        metadata: { ...settings.metadata, autoLinkOnMatch: checked },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* TPDB Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      ThePornDB (TPDB)
                    </CardTitle>
                    <CardDescription>
                      Configure TPDB API for metadata fetching
                    </CardDescription>
                  </div>
                  <Switch
                    checked={settings.tpdb.enabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        tpdb: { ...settings.tpdb, enabled: checked },
                      })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tpdbUrl">API URL</Label>
                  <Input
                    id="tpdbUrl"
                    value={settings.tpdb.apiUrl}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tpdb: { ...settings.tpdb, apiUrl: e.target.value },
                      })
                    }
                    placeholder="https://api.theporndb.net"
                    disabled={!settings.tpdb.enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpdbKey">API Key</Label>
                  <Input
                    id="tpdbKey"
                    type="password"
                    value={settings.tpdb.apiKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tpdb: { ...settings.tpdb, apiKey: e.target.value },
                      })
                    }
                    placeholder="Enter your TPDB API key"
                    disabled={!settings.tpdb.enabled}
                  />
                  <p className="text-muted-foreground text-xs">
                    Get your API key from{" "}
                    <a
                      href="https://metadataapi.net"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      metadataapi.net
                    </a>
                  </p>
                </div>

                <Button
                  onClick={() => handleTestConnection("tpdb")}
                  disabled={!settings.tpdb.enabled || testConnection.isPending}
                  variant="outline"
                >
                  {testConnection.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
              </CardContent>
            </Card>

            {/* StashDB Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      StashDB
                    </CardTitle>
                    <CardDescription>
                      Configure StashDB API for metadata fetching
                    </CardDescription>
                  </div>
                  <Switch
                    checked={settings.stashdb.enabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        stashdb: { ...settings.stashdb, enabled: checked },
                      })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stashdbUrl">API URL</Label>
                  <Input
                    id="stashdbUrl"
                    value={settings.stashdb.apiUrl}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        stashdb: { ...settings.stashdb, apiUrl: e.target.value },
                      })
                    }
                    placeholder="https://stashdb.org/graphql"
                    disabled={!settings.stashdb.enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stashdbKey">API Key</Label>
                  <Input
                    id="stashdbKey"
                    type="password"
                    value={settings.stashdb.apiKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        stashdb: { ...settings.stashdb, apiKey: e.target.value },
                      })
                    }
                    placeholder="Enter your StashDB API key"
                    disabled={!settings.stashdb.enabled}
                  />
                </div>

                <Button
                  onClick={() => handleTestConnection("stashdb")}
                  disabled={!settings.stashdb.enabled || testConnection.isPending}
                  variant="outline"
                >
                  {testConnection.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prowlarr Settings */}
        <TabsContent value="prowlarr" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Prowlarr Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure Prowlarr for indexer management
                  </CardDescription>
                </div>
                <Switch
                  checked={settings.prowlarr.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      prowlarr: { ...settings.prowlarr, enabled: checked },
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prowlarrUrl">API URL</Label>
                <Input
                  id="prowlarrUrl"
                  value={settings.prowlarr.apiUrl}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      prowlarr: {
                        ...settings.prowlarr,
                        apiUrl: e.target.value,
                      },
                    })
                  }
                  placeholder="http://localhost:9696"
                  disabled={!settings.prowlarr.enabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prowlarrKey">API Key</Label>
                <Input
                  id="prowlarrKey"
                  type="password"
                  value={settings.prowlarr.apiKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      prowlarr: {
                        ...settings.prowlarr,
                        apiKey: e.target.value,
                      },
                    })
                  }
                  placeholder="Enter your Prowlarr API key"
                  disabled={!settings.prowlarr.enabled}
                />
              </div>

              <Button
                onClick={() => handleTestConnection("prowlarr")}
                disabled={!settings.prowlarr.enabled || testConnection.isPending}
                variant="outline"
              >
                {testConnection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* qBittorrent Settings */}
        <TabsContent value="qbittorrent" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    qBittorrent Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure qBittorrent Web UI connection
                  </CardDescription>
                </div>
                <Switch
                  checked={settings.qbittorrent.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      qbittorrent: {
                        ...settings.qbittorrent,
                        enabled: checked,
                      },
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qbitUrl">Web UI URL</Label>
                <Input
                  id="qbitUrl"
                  value={settings.qbittorrent.url}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      qbittorrent: {
                        ...settings.qbittorrent,
                        url: e.target.value,
                      },
                    })
                  }
                  placeholder="http://localhost:8080"
                  disabled={!settings.qbittorrent.enabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qbitUsername">Username</Label>
                <Input
                  id="qbitUsername"
                  value={settings.qbittorrent.username}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      qbittorrent: {
                        ...settings.qbittorrent,
                        username: e.target.value,
                      },
                    })
                  }
                  placeholder="admin"
                  disabled={!settings.qbittorrent.enabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qbitPassword">Password</Label>
                <Input
                  id="qbitPassword"
                  type="password"
                  value={settings.qbittorrent.password}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      qbittorrent: {
                        ...settings.qbittorrent,
                        password: e.target.value,
                      },
                    })
                  }
                  placeholder="Enter password"
                  disabled={!settings.qbittorrent.enabled}
                />
              </div>

              <Button
                onClick={() => handleTestConnection("qbittorrent")}
                disabled={!settings.qbittorrent.enabled || testConnection.isPending}
                variant="outline"
              >
                {testConnection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    AI Semantic Matching
                  </CardTitle>
                  <CardDescription>
                    Enable local AI embeddings for better scene matching across languages and typos
                  </CardDescription>
                </div>
                <Switch
                  checked={settings.ai.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      ai: { ...settings.ai, enabled: checked },
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiModel">Embedding Model</Label>
                <Select
                  value={settings.ai.model}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      ai: { ...settings.ai, model: value },
                    })
                  }
                  disabled={!settings.ai.enabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Xenova/all-MiniLM-L6-v2">
                      all-MiniLM-L6-v2 (Fast, 80MB - Recommended)
                    </SelectItem>
                    <SelectItem value="Xenova/all-mpnet-base-v2">
                      all-mpnet-base-v2 (Better quality, 420MB)
                    </SelectItem>
                    <SelectItem value="Xenova/paraphrase-multilingual-MiniLM-L12-v2">
                      paraphrase-multilingual-MiniLM-L12-v2 (50+ languages, 420MB)
                    </SelectItem>
                    <SelectItem value="Xenova/all-distilroberta-v1">
                      all-distilroberta-v1 (High quality, 290MB)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Local embedding model (no API key needed, runs in-process)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiThreshold">Cosine Similarity Threshold</Label>
                <Input
                  id="aiThreshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.ai.threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ai: {
                        ...settings.ai,
                        threshold: parseFloat(e.target.value) || 0.75,
                      },
                    })
                  }
                  disabled={!settings.ai.enabled}
                />
                <p className="text-muted-foreground text-xs">
                  Minimum cosine similarity for AI matches (0.75 = 75% similarity, default: 0.75)
                </p>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> AI matching uses local embeddings for semantic similarity.
                  Great for matching scenes across different languages, handling typos, and understanding rewording.
                  Falls back to traditional Levenshtein matching if AI fails.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
