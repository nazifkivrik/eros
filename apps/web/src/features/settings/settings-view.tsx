"use client";

import { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  Brain,
  HardDrive,
  Download,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QualityProfilesTab } from "@/components/settings/QualityProfilesTab";
import { DownloadPathsSection } from "@/components/settings/DownloadPathsSection";
import { UserCredentialsSection } from "@/components/settings/UserCredentialsSection";
import { SpeedScheduleTab } from "@/components/settings/SpeedScheduleTab";
import { ServicesTab } from "@/components/settings/ServicesTab";
import { useSettings, useUpdateSettings, useAIModelStatus, useLoadAIModel } from "./hooks";
import type { AppSettings } from "@repo/shared-types";
import { DEFAULT_SETTINGS } from "@repo/shared-types";

/**
 * @view SettingsView
 * @description Settings view with general, quality profiles, and services configuration.
 */
export function SettingsView() {
  const { data: settingsData, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
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
        speedSchedule: { ...DEFAULT_SETTINGS.speedSchedule, ...(data.speedSchedule || {}) },
        downloadPaths: { ...DEFAULT_SETTINGS.downloadPaths, ...(data.downloadPaths || {}) },
      });
    }
  }, [settingsData]);

  const handleSave = () => {
    updateSettings.mutate(settings);
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
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure your Eros installation
              </p>
            </div>
            <Button onClick={handleSave} disabled={updateSettings.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="quality">Quality Profiles</TabsTrigger>
          <TabsTrigger value="speed">Speed Schedule</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6 space-y-6">
          {/* Download Paths Section */}
          <div>
            <DownloadPathsSection
              settings={settings.downloadPaths}
              onChange={(downloadPaths) => setSettings({ ...settings, downloadPaths })}
            />
          </div>

          {/* User Credentials Section */}
          <div>
            <UserCredentialsSection />
          </div>

          {/* AI Settings Section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">AI Settings</h3>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* AI Model Status Card */}
                {settings.ai.useCrossEncoder && (
                  <div className="p-4 rounded-lg border bg-card">
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

                <div className="space-y-4">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quality Profiles Tab */}
        <TabsContent value="quality" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <QualityProfilesTab />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Speed Schedule Tab */}
        <TabsContent value="speed" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <SpeedScheduleTab
                settings={settings.speedSchedule}
                onChange={(speedSchedule) => setSettings({ ...settings, speedSchedule })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Settings */}
        <TabsContent value="services" className="mt-6">
          <ServicesTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}
