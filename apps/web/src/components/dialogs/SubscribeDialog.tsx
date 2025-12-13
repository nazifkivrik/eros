"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

interface SubscribeDialogProps {
  entity: {
    id: string;
    name?: string;
    title?: string;
    type: "performer" | "studio" | "scene";
  } | null;
  onClose: () => void;
  onConfirm: (settings: SubscriptionSettings) => void;
}

interface SubscriptionSettings {
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
}

export function SubscribeDialog({
  entity,
  onClose,
  onConfirm,
}: SubscribeDialogProps) {
  const [settings, setSettings] = useState<SubscriptionSettings>({
    qualityProfileId: "",
    autoDownload: true,
    includeMetadataMissing: false,
    includeAliases: false,
  });

  const { data: qualityProfiles } = useQuery({
    queryKey: ["quality-profiles"],
    queryFn: () => apiClient.getQualityProfiles(),
  });

  const handleSubmit = () => {
    if (!settings.qualityProfileId) {
      toast.error("Please select a quality profile");
      return;
    }
    onConfirm(settings);
  };

  const entityName = entity?.name || entity?.title || "Unknown";
  const showAliasOption =
    entity?.type === "performer" || entity?.type === "studio";

  return (
    <Dialog open={!!entity} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby="subscribe-description">
        <DialogHeader>
          <DialogTitle>Subscribe to {entityName}</DialogTitle>
          <DialogDescription id="subscribe-description">
            Configure subscription settings for this {entity?.type}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quality Profile */}
          <div className="space-y-2">
            <Label htmlFor="quality-profile">Quality Profile</Label>
            <Select
              value={settings.qualityProfileId}
              onValueChange={(value) =>
                setSettings({ ...settings, qualityProfileId: value })
              }
            >
              <SelectTrigger id="quality-profile">
                <SelectValue placeholder="Select a quality profile" />
              </SelectTrigger>
              <SelectContent>
                {qualityProfiles?.data.map((profile: any) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Quality profile determines download quality preferences
            </p>
          </div>

          {/* Auto Download */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="auto-download">Auto Download</Label>
              <p className="text-sm text-muted-foreground">
                Automatically download new content when available
              </p>
            </div>
            <Switch
              id="auto-download"
              checked={settings.autoDownload}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, autoDownload: checked })
              }
            />
          </div>

          {/* Include Metadata Missing */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="metadata-missing">Include Metadata Missing</Label>
              <p className="text-sm text-muted-foreground">
                Download scenes without metadata (inferred from indexers)
              </p>
            </div>
            <Switch
              id="metadata-missing"
              checked={settings.includeMetadataMissing}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  includeMetadataMissing: checked,
                })
              }
            />
          </div>

          {/* Include Aliases */}
          {showAliasOption && (
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="include-aliases">Include Aliases</Label>
                <p className="text-sm text-muted-foreground">
                  Search using all known aliases for this {entity?.type}
                </p>
              </div>
              <Switch
                id="include-aliases"
                checked={settings.includeAliases}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, includeAliases: checked })
                }
              />
            </div>
          )}

          {/* Info Box */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-3">What happens next?</h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span>
                    {entity?.type === "performer" || entity?.type === "studio"
                      ? "All scenes will be found and subscribed"
                      : "Scene will be added to download queue"}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span>Background jobs will search for new content</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span>Downloads will start based on your settings</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!settings.qualityProfileId}>
            Subscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
