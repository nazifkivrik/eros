"use client";

import { useState } from "react";
import { QualityProfilesHeader } from "./components/quality-profiles-header";
import { QualityProfileCard } from "./components/quality-profile-card";
import { QualityProfilesSkeleton } from "./components/quality-profiles-skeleton";
import { QualityProfilesEmpty } from "./components/quality-profiles-empty";
import { QualityProfileDialog } from "./components/quality-profile-dialog";
import {
  useQualityProfiles,
  useCreateQualityProfile,
  useUpdateQualityProfile,
  useDeleteQualityProfile,
} from "./hooks/use-quality-profiles";
import type { QualityProfile } from "@repo/shared-types";

/**
 * Quality Profiles View
 * Composes quality profiles UI components and manages data fetching
 * Handles state orchestration but no direct UI rendering
 */
export function QualityProfilesView() {
  const { data: profiles, isLoading } = useQualityProfiles();
  const createProfile = useCreateQualityProfile();
  const updateProfile = useUpdateQualityProfile();
  const deleteProfile = useDeleteQualityProfile();

  const [editingProfile, setEditingProfile] = useState<QualityProfile | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreate = async (data: { name: string; items: any[] }) => {
    await createProfile.mutateAsync(data);
  };

  const handleUpdate = async (data: { name: string; items: any[] }) => {
    if (!editingProfile) return;
    await updateProfile.mutateAsync({ id: editingProfile.id, data });
  };

  const handleDelete = (profile: QualityProfile) => {
    if (
      confirm(
        `Are you sure you want to delete "${profile.name}"? This action cannot be undone.`
      )
    ) {
      deleteProfile.mutate(profile.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <QualityProfilesHeader onCreateClick={() => setIsCreateDialogOpen(true)} />
        <QualityProfilesSkeleton />
      </div>
    );
  }

  if (!profiles?.data?.length) {
    return (
      <div className="space-y-6">
        <QualityProfilesHeader onCreateClick={() => setIsCreateDialogOpen(true)} />
        <QualityProfilesEmpty />
        <QualityProfileDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          profile={null}
          onSubmit={handleCreate}
          isPending={createProfile.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <QualityProfilesHeader onCreateClick={() => setIsCreateDialogOpen(true)} />

      <div className="grid gap-4">
        {profiles.data.map((profile) => (
          <QualityProfileCard
            key={profile.id}
            profile={profile}
            onEdit={() => setEditingProfile(profile)}
            onDelete={() => handleDelete(profile)}
          />
        ))}
      </div>

      <QualityProfileDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        profile={null}
        onSubmit={handleCreate}
        isPending={createProfile.isPending}
      />

      <QualityProfileDialog
        open={!!editingProfile}
        onOpenChange={(open) => !open && setEditingProfile(null)}
        profile={editingProfile}
        onSubmit={handleUpdate}
        isPending={updateProfile.isPending}
      />
    </div>
  );
}
