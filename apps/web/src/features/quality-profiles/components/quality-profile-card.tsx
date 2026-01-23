import type { FC } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QualityProfile } from "@repo/shared-types";

export interface QualityProfileCardProps {
  profile: QualityProfile;
  onEdit: () => void;
  onDelete: () => void;
}

export const QualityProfileCard: FC<QualityProfileCardProps> = ({
  profile,
  onEdit,
  onDelete,
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle>{profile.name}</CardTitle>
            <CardDescription className="mt-1">
              <span className="font-medium">{profile.items.length}</span>{" "}
              {profile.items.length === 1 ? "quality" : "qualities"} configured
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm font-medium">Quality Order (Best → Worst):</div>
          <div className="flex flex-wrap gap-2">
            {profile.items.map((item, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                <span className="font-medium">{item.quality}</span> • {item.source}
                {item.minSeeders !== 0 && item.minSeeders !== "any" && (
                  <span className="ml-1 font-normal opacity-70">
                    (min {item.minSeeders} seeds)
                  </span>
                )}
                {item.minSeeders === "any" && (
                  <span className="ml-1 font-normal opacity-70">(any seeds)</span>
                )}
                {item.maxSize > 0 && (
                  <span className="ml-1 font-normal opacity-70">
                    (max {item.maxSize}GB)
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
