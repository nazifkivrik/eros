import type { FC } from "react";
import { Button } from "@/components/ui/button";

export interface QualityProfilesHeaderProps {
  onCreateClick: () => void;
}

export const QualityProfilesHeader: FC<QualityProfilesHeaderProps> = ({
  onCreateClick,
}) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold">Quality Profiles</h1>
        <p className="text-muted-foreground mt-2">
          Manage quality preferences for downloads. Profiles are automatically
          sorted from best to worst quality.
        </p>
      </div>
      <Button onClick={onCreateClick}>+ Create Profile</Button>
    </div>
  );
};
