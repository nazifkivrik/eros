"use client";

import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Save,
  Server,
  Database,
  Download,
  RefreshCw,
  Loader2,
  Brain,
  XCircle,
  HardDrive,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QualityProfilesTab } from "@/components/settings/QualityProfilesTab";
import { useSettings, useUpdateSettings, useTestConnection, useAIModelStatus, useLoadAIModel } from "@/hooks/useSettings";
import type { AppSettings } from "@repo/shared-types";
import { DEFAULT_SETTINGS } from "@repo/shared-types";

export default function SettingsPage() {
  const { data: settingsData, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const testConnection = useTestConnection();
  const { data: aiStatus } = useAIModelStatus();
  const loadAIModel = useLoadAIModel();

  // Debug: Log AI status to check value
  useEffect(() => {
    console.log("AI Status:", aiStatus);
    console.log("modelDownloaded value:", aiStatus?.modelDownloaded);
  }, [aiStatus]);

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
          <TabsTrigger value="services">Services</TabsTrigger>
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

              <div className="border-t pt-4">
                {/* AI Model Status Card */}
                {settings.ai.useCrossEncoder && (
                  <div className="mb-4 p-4 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      <Brain className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium">AI Model</h4>
                            <p className="text-xs text-muted-foreground">
                              {aiStatus?.modelName || "Xenova/ms-marco-MiniLM-L-6-v2"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {aiStatus?.modelDownloaded ? (
                              <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                                <HardDrive className="h-3 w-3" />
                                Downloaded
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={loadAIModel.isPending}
                                onClick={() => loadAIModel.mutate()}
                              >
                                {loadAIModel.isPending ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3 w-3 mr-1" />
                                    Download Model
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        {aiStatus?.modelDownloaded && (
                          <p className="text-xs text-muted-foreground">
                            Model is downloaded and will be loaded into RAM automatically when needed (lazy load)
                          </p>
                        )}
                        {aiStatus?.error && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="font-mono break-all">{aiStatus.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 pl-0">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="useCrossEncoder">
                        Use Cross-Encoder (Advanced)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        More accurate pair-wise ranking vs bi-encoder embeddings (slower but better quality)
                      </p>
                    </div>
                    <Switch
                      id="useCrossEncoder"
                      checked={settings.ai.useCrossEncoder ?? true}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          ai: { ...settings.ai, useCrossEncoder: checked },
                        })
                      }
                    />
                  </div>

                  {settings.ai.useCrossEncoder && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="crossEncoderThreshold">
                          Cross-Encoder Match Threshold
                        </Label>
                        <Input
                          id="crossEncoderThreshold"
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={settings.ai.crossEncoderThreshold ?? 0.65}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              ai: {
                                ...settings.ai,
                                crossEncoderThreshold: parseFloat(e.target.value) || 0.65,
                              },
                            })
                          }
                        />
                        <p className="text-muted-foreground text-xs">
                          Minimum score to consider a match (default: 0.65)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="unknownThreshold">
                          Unknown Content Threshold
                        </Label>
                        <Input
                          id="unknownThreshold"
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={settings.ai.unknownThreshold ?? 0.35}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              ai: {
                                ...settings.ai,
                                unknownThreshold: parseFloat(e.target.value) || 0.35,
                              },
                            })
                          }
                        />
                        <p className="text-muted-foreground text-xs">
                          Below this score, content is marked as unknown/new (default: 0.35)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="groupingCount">
                          Cross-Encoder Candidate Count
                        </Label>
                        <Input
                          id="groupingCount"
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={settings.ai.groupingCount ?? 10}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              ai: {
                                ...settings.ai,
                                groupingCount: parseInt(e.target.value) || 10,
                              },
                            })
                          }
                        />
                        <p className="text-muted-foreground text-xs">
                          Number of top candidates to evaluate with Cross-Encoder (default: 10)
                        </p>
                      </div>
                    </>
                  )}

                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Cross-Encoder Matching:</strong> Evaluates torrent-scene pairs together for superior accuracy. Uses string-based pre-filtering to select top candidates, then applies Cross-Encoder for precise ranking. Runs locally without API keys.
                    </p>
                  </div>
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

        {/* Services Settings */}
        <TabsContent value="services" className="mt-6">
          <div className="space-y-6">
            {/* Metadata Services Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Metadata Services</h3>

              {/* TPDB Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    ThePornDB (TPDB)
                  </CardTitle>
                  <CardDescription>
                    Configure TPDB API for metadata lookups
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tpdbEnabled">Enable TPDB</Label>
                    <Switch
                      id="tpdbEnabled"
                      checked={settings.tpdb.enabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          tpdb: { ...settings.tpdb, enabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tpdbApiUrl">API URL</Label>
                    <Input
                      id="tpdbApiUrl"
                      value={settings.tpdb.apiUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          tpdb: { ...settings.tpdb, apiUrl: e.target.value },
                        })
                      }
                      placeholder="https://api.theporndb.net"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tpdbApiKey">API Key</Label>
                    <Input
                      id="tpdbApiKey"
                      type="password"
                      value={settings.tpdb.apiKey}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          tpdb: { ...settings.tpdb, apiKey: e.target.value },
                        })
                      }
                      placeholder="Enter TPDB API key"
                    />
                  </div>

                  <Button
                    onClick={() => handleTestConnection("tpdb")}
                    disabled={testConnection.isPending}
                    variant="outline"
                    size="sm"
                  >
                    {testConnection.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* StashDB Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>StashDB</CardTitle>
                  <CardDescription>
                    Configure StashDB GraphQL API for metadata lookups
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stashdbEnabled">Enable StashDB</Label>
                    <Switch
                      id="stashdbEnabled"
                      checked={settings.stashdb.enabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          stashdb: { ...settings.stashdb, enabled: checked },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stashdbApiUrl">API URL</Label>
                    <Input
                      id="stashdbApiUrl"
                      value={settings.stashdb.apiUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          stashdb: { ...settings.stashdb, apiUrl: e.target.value },
                        })
                      }
                      placeholder="https://stashdb.org/graphql"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stashdbApiKey">API Key</Label>
                    <Input
                      id="stashdbApiKey"
                      type="password"
                      value={settings.stashdb.apiKey}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          stashdb: { ...settings.stashdb, apiKey: e.target.value },
                        })
                      }
                      placeholder="Enter StashDB API key"
                    />
                  </div>

                  <Button
                    onClick={() => handleTestConnection("stashdb")}
                    disabled={testConnection.isPending}
                    variant="outline"
                    size="sm"
                  >
                    {testConnection.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Prowlarr Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Indexer Services</h3>

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
            </div>

            {/* Download Services Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Download Services</h3>

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
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
