"use client";

import { Settings2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { TorrentAutoManagementSettings } from "@repo/shared-types";

interface TorrentManagementTabProps {
  settings: TorrentAutoManagementSettings;
  onChange: (settings: TorrentAutoManagementSettings) => void;
}

export function TorrentManagementTab({
  settings,
  onChange,
}: TorrentManagementTabProps) {
  const updateSetting = <K extends keyof TorrentAutoManagementSettings>(
    key: K,
    value: TorrentAutoManagementSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const updateNestedSetting = <
    K extends keyof TorrentAutoManagementSettings,
    NK extends keyof NonNullable<TorrentAutoManagementSettings[K]>
  >(
    key: K,
    nestedKey: NK,
    value: NonNullable<TorrentAutoManagementSettings[K]>[NK]
  ) => {
    const current = settings[key];
    if (typeof current === "object" && current !== null) {
      onChange({
        ...settings,
        [key]: { ...current, [nestedKey]: value },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Auto Torrent Management</h3>
          <p className="text-sm text-muted-foreground">
            Automatically pause and retry slow or stalled torrents
          </p>
        </div>
        <Button
          size="sm"
          variant={settings.enabled ? "default" : "outline"}
          onClick={() => updateSetting("enabled", !settings.enabled)}
        >
          <Settings2 className="h-4 w-4 mr-2" />
          {settings.enabled ? "Enabled" : "Enable"}
        </Button>
      </div>

      {!settings.enabled && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Auto torrent management is disabled. Enable to configure automatic pause and retry behavior.
            </p>
          </CardContent>
        </Card>
      )}

      {settings.enabled && (
        <>
          {/* Pause Conditions Section */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h4 className="font-medium">Pause Conditions</h4>

              {/* Stalled Torrents */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pause Stalled Torrents</Label>
                    <p className="text-xs text-muted-foreground">
                      Pause torrents with no seeders or very low speeds
                    </p>
                  </div>
                  <Switch
                    checked={settings.pauseOnStalled}
                    onCheckedChange={(v) => updateSetting("pauseOnStalled", v)}
                  />
                </div>

                {settings.pauseOnStalled && (
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label>Max Seeders</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.stallThreshold.maxSeeders}
                        onChange={(e) =>
                          updateNestedSetting("stallThreshold", "maxSeeders", parseInt(e.target.value) || 0)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Pause if seeders ≤ this value
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Min Speed (KB/s)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.stallThreshold.minSpeed / 1024}
                        onChange={(e) =>
                          updateNestedSetting("stallThreshold", "minSpeed", (parseInt(e.target.value) || 0) * 1024)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Pause if speed &lt; this AND seeders &lt; 2
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata Stuck */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pause Metadata Downloads</Label>
                  <p className="text-xs text-muted-foreground">
                    Pause torrents stuck in &quot;downloading metadata&quot; state
                  </p>
                </div>
                <Switch
                  checked={settings.pauseOnMetadataStuck}
                  onCheckedChange={(v) => updateSetting("pauseOnMetadataStuck", v)}
                />
              </div>

              {settings.pauseOnMetadataStuck && (
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  <Label>Timeout (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.metadataTimeoutMinutes}
                    onChange={(e) =>
                      updateSetting("metadataTimeoutMinutes", parseInt(e.target.value) || 30)
                    }
                  />
                </div>
              )}

              {/* Slow Speed */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pause Slow Downloads</Label>
                  <p className="text-xs text-muted-foreground">
                    Pause torrents with consistently low download speeds
                  </p>
                </div>
                <Switch
                  checked={settings.pauseOnSlowSpeed}
                  onCheckedChange={(v) => updateSetting("pauseOnSlowSpeed", v)}
                />
              </div>

              {settings.pauseOnSlowSpeed && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Speed Threshold (KB/s)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settings.slowSpeedThreshold / 1024}
                      onChange={(e) =>
                        updateSetting("slowSpeedThreshold", (parseInt(e.target.value) || 0) * 1024)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settings.slowSpeedDurationMinutes}
                      onChange={(e) =>
                        updateSetting("slowSpeedDurationMinutes", parseInt(e.target.value) || 10)
                      }
                    />
                  </div>
                </div>
              )}

              {/* No Activity */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pause Inactive Torrents</Label>
                  <p className="text-xs text-muted-foreground">
                    Pause torrents with no download activity for a period
                  </p>
                </div>
                <Switch
                  checked={settings.pauseOnNoActivity}
                  onCheckedChange={(v) => updateSetting("pauseOnNoActivity", v)}
                />
              </div>

              {settings.pauseOnNoActivity && (
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  <Label>No Activity Threshold (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.noActivityMinutes}
                    onChange={(e) =>
                      updateSetting("noActivityMinutes", parseInt(e.target.value) || 15)
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retry Behavior Section */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h4 className="font-medium">Retry Behavior</h4>

              <div className="space-y-2">
                <Label>Max Retries</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxRetries}
                  onChange={(e) => updateSetting("maxRetries", parseInt(e.target.value) || 3)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of times to retry a paused torrent
                </p>
              </div>

              <div className="space-y-2">
                <Label>Retry Behavior</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={settings.retryBehavior}
                  onChange={(e) =>
                    updateSetting("retryBehavior", e.target.value as any)
                  }
                >
                  <option value="queue_empty">
                    When Queue Empty - Only retry when no other downloads
                  </option>
                  <option value="immediate">
                    Immediate - Retry right away
                  </option>
                  <option value="delayed">
                    Delayed - Retry after a delay period
                  </option>
                </select>
              </div>

              {settings.retryBehavior === "delayed" && (
                <div className="space-y-2">
                  <Label>Retry Delay (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.retryDelayMinutes}
                    onChange={(e) =>
                      updateSetting("retryDelayMinutes", parseInt(e.target.value) || 5)
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priority System Section */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <h4 className="font-medium">Combined Priority System</h4>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Combined Priority</Label>
                  <p className="text-xs text-muted-foreground">
                    Combine queue position with retry count for smarter prioritization
                  </p>
                </div>
                <Switch
                  checked={settings.useCombinedPriority}
                  onCheckedChange={(v) => updateSetting("useCombinedPriority", v)}
                />
              </div>

              {settings.useCombinedPriority && (
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  <Label>Retry Count Weight</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={settings.retryCountWeight}
                    onChange={(e) =>
                      updateSetting("retryCountWeight", parseInt(e.target.value) || 100)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher values give priority to torrents with fewer retries
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
