"use client";

import { useState } from "react";
import { Plus, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SpeedScheduleSettings, SpeedProfile } from "@repo/shared-types";

interface SpeedScheduleTabProps {
  settings: SpeedScheduleSettings;
  onChange: (settings: SpeedScheduleSettings) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PRESET_COLORS = [
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Gray", value: "#6b7280" },
];

export function SpeedScheduleTab({ settings, onChange }: SpeedScheduleTabProps) {
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<SpeedProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    color: PRESET_COLORS[0].value,
    downloadLimit: 0,
    uploadLimit: 0,
  });

  // Create a map for quick slot lookup
  const slotMap = new Map(
    settings.schedule.map((slot) => [`${slot.dayOfWeek}-${slot.hour}`, slot] as const)
  );

  const getSlotProfile = (dayOfWeek: number, hour: number): SpeedProfile | undefined => {
    const slot = slotMap.get(`${dayOfWeek}-${hour}`);
    return settings.profiles.find((p) => p.id === slot?.speedProfileId);
  };

  const handleSlotClick = (dayOfWeek: number, hour: number) => {
    if (!selectedProfileId) return;

    const updatedSlots = settings.schedule.map((slot) =>
      slot.dayOfWeek === dayOfWeek && slot.hour === hour
        ? { ...slot, speedProfileId: selectedProfileId }
        : slot
    );

    onChange({ ...settings, schedule: updatedSlots });
  };

  const handleApplyPreset = (preset: "weekday" | "weekend" | "all") => {
    if (!selectedProfileId) return;

    let targetDays: number[];
    if (preset === "weekday") {
      targetDays = [1, 2, 3, 4, 5]; // Mon-Fri
    } else if (preset === "weekend") {
      targetDays = [0, 6]; // Sun, Sat
    } else {
      targetDays = [0, 1, 2, 3, 4, 5, 6];
    }

    const updatedSlots = settings.schedule.map((slot) =>
      targetDays.includes(slot.dayOfWeek)
        ? { ...slot, speedProfileId: selectedProfileId }
        : slot
    );

    onChange({ ...settings, schedule: updatedSlots });
  };

  const handleCopyDay = (fromDay: number, toDay: number) => {
    const fromSlots = settings.schedule.filter((s) => s.dayOfWeek === fromDay);
    const updatedSlots = settings.schedule.map((slot) =>
      slot.dayOfWeek === toDay
        ? { ...slot, speedProfileId: fromSlots[slot.hour]?.speedProfileId || settings.profiles[0]?.id || "" }
        : slot
    );

    onChange({ ...settings, schedule: updatedSlots });
  };

  const handleSaveProfile = () => {
    if (!profileForm.name.trim()) return;

    let updatedProfiles: SpeedProfile[];

    if (editingProfile) {
      updatedProfiles = settings.profiles.map((p) =>
        p.id === editingProfile.id
          ? { ...p, name: profileForm.name.trim(), color: profileForm.color, downloadLimit: profileForm.downloadLimit, uploadLimit: profileForm.uploadLimit }
          : p
      );
    } else {
      const newProfile: SpeedProfile = {
        id: `profile-${Date.now()}`,
        name: profileForm.name.trim(),
        color: profileForm.color,
        downloadLimit: profileForm.downloadLimit,
        uploadLimit: profileForm.uploadLimit,
      };
      updatedProfiles = [...settings.profiles, newProfile];
    }

    onChange({ ...settings, profiles: updatedProfiles });
    setIsProfileDialogOpen(false);
    setEditingProfile(null);
    setProfileForm({ name: "", color: PRESET_COLORS[0].value, downloadLimit: 0, uploadLimit: 0 });
  };

  const handleDeleteProfile = (id: string) => {
    if (settings.profiles.length <= 1) return;

    const updatedProfiles = settings.profiles.filter((p) => p.id !== id);
    const fallbackProfileId = updatedProfiles[0]?.id || "";

    const updatedSlots = settings.schedule.map((slot) =>
      slot.speedProfileId === id
        ? { ...slot, speedProfileId: fallbackProfileId }
        : slot
    );

    onChange({ ...settings, profiles: updatedProfiles, schedule: updatedSlots });
  };

  const formatSpeed = (kbps: number) => {
    if (kbps === 0) return "Unlimited";
    const mbps = kbps / 1024;
    return mbps >= 1 ? `${mbps.toFixed(1)} MB/s` : `${kbps} KB/s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Speed Schedule</h3>
          <p className="text-sm text-muted-foreground">
            Configure time-based speed limits for torrents
          </p>
        </div>
        <Button
          size="sm"
          variant={settings.enabled ? "default" : "outline"}
          onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
        >
          <Gauge className="h-4 w-4 mr-2" />
          {settings.enabled ? "Enabled" : "Enable"}
        </Button>
      </div>

      {/* Profiles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Speed Profiles</Label>
          <Button size="sm" variant="outline" onClick={() => { setEditingProfile(null); setIsProfileDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            New Profile
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {settings.profiles.map((profile) => (
            <Badge
              key={profile.id}
              variant={selectedProfileId === profile.id ? "default" : "outline"}
              className="cursor-pointer px-3 py-1"
              style={{
                backgroundColor: selectedProfileId === profile.id ? profile.color : undefined,
                borderColor: profile.color,
                color: selectedProfileId === profile.id ? "white" : undefined,
              }}
              onClick={() => setSelectedProfileId(profile.id)}
            >
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: profile.color }} />
              {profile.name}
              <span className="ml-2 text-xs opacity-70">
                ↓{formatSpeed(profile.downloadLimit)} ↑{formatSpeed(profile.uploadLimit)}
              </span>
              {settings.profiles.length > 1 && selectedProfileId === profile.id && (
                <button
                  className="ml-2 hover:text-red-300"
                  onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                >
                  ×
                </button>
              )}
            </Badge>
          ))}
        </div>

        {selectedProfileId && (
          <p className="text-sm text-muted-foreground">
            Selected: {settings.profiles.find((p) => p.id === selectedProfileId)?.name} - Click slots to apply
          </p>
        )}
      </div>

      {/* Quick Actions */}
      {selectedProfileId && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleApplyPreset("weekday")}>
            Apply to Weekdays
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleApplyPreset("weekend")}>
            Apply to Weekends
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleApplyPreset("all")}>
            Apply to All
          </Button>

          <select
            className="text-sm border rounded px-2 py-1"
            onChange={(e) => {
              const [from, to] = e.target.value.split("-");
              if (from && to) handleCopyDay(parseInt(from), parseInt(to));
            }}
            defaultValue=""
          >
            <option value="" disabled>Copy day...</option>
            {DAYS.map((fromDay, fromIdx) => (
              DAYS.map((toDay, toIdx) => (
                <option key={`${fromIdx}-${toIdx}`} value={`${fromIdx}-${toIdx}`}>
                  Copy {fromDay} to {toDay}
                </option>
              ))
            ))}
          </select>
        </div>
      )}

      {/* Weekly Calendar */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Hour header */}
          <div className="flex border-b">
            <div className="w-12 flex-shrink-0" />
            {HOURS.map((hour) => (
              <div key={hour} className="w-8 flex-shrink-0 text-xs text-center text-muted-foreground py-1">
                {hour}
              </div>
            ))}
          </div>

          {/* Days */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex border-b last:border-b-0">
              <div className="w-12 flex-shrink-0 text-xs text-muted-foreground p-1 text-right">
                {day}
              </div>
              {HOURS.map((hour) => {
                const profile = getSlotProfile(dayIdx, hour);
                return (
                  <div
                    key={hour}
                    className="w-8 h-8 flex-shrink-0 border-r last:border-r-0 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: profile?.color || "#e5e7eb" }}
                    onClick={() => handleSlotClick(dayIdx, hour)}
                    title={`${day} ${hour}:00 - ${profile?.name || "Unassigned"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Profile" : "New Speed Profile"}</DialogTitle>
            <DialogDescription>
              Configure a speed profile with download and upload limits
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profileName">Name</Label>
              <Input
                id="profileName"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="e.g., Daytime, Night, Unlimited"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileColor">Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      profileForm.color === color.value ? "border-black" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setProfileForm({ ...profileForm, color: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="downloadLimit">Download Limit (KB/s, 0 = unlimited)</Label>
              <Input
                id="downloadLimit"
                type="number"
                min="0"
                value={profileForm.downloadLimit}
                onChange={(e) => setProfileForm({ ...profileForm, downloadLimit: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uploadLimit">Upload Limit (KB/s, 0 = unlimited)</Label>
              <Input
                id="uploadLimit"
                type="number"
                min="0"
                value={profileForm.uploadLimit}
                onChange={(e) => setProfileForm({ ...profileForm, uploadLimit: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile}>
              {editingProfile ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
