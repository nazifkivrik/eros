/**
 * Studio Card Component
 * Presentational component for displaying a studio subscription
 */

import type { SubscriptionDetail, Studio } from "@repo/shared-types";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubscriptionImage } from "@/components/subscriptions/SubscriptionImage";
import { Star, Building2 } from "lucide-react";

interface StudioCardProps {
  subscription: SubscriptionDetail;
  onDelete: (subscription: SubscriptionDetail, e: React.MouseEvent) => void;
  isDeletePending?: boolean;
}

export function StudioCard({ subscription, onDelete, isDeletePending }: StudioCardProps) {
  const studio = subscription.entity as Studio | null;

  // Helper to get the best image URL from entity data
  const getEntityImageUrl = (entity: any): string | null => {
    if (!entity) return null;

    const images = entity.images
      ? typeof entity.images === "string"
        ? JSON.parse(entity.images)
        : entity.images
      : [];

    if (images.length > 0 && images[0]?.url) {
      return images[0].url;
    }

    if (entity.poster) return entity.poster;
    if (entity.thumbnail) return entity.thumbnail;
    if (entity.logo) return entity.logo;

    return null;
  };

  return (
    <Link href={`/subscriptions/${subscription.id}`}>
      <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden">
        <SubscriptionImage
          src={getEntityImageUrl(subscription.entity)}
          alt={subscription.entityName}
          type="studio"
        />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate text-base">{subscription.entityName}</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {subscription.qualityProfile?.name || "No quality profile"}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => onDelete(subscription, e)}
              disabled={isDeletePending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex gap-1 flex-wrap text-xs">
            {subscription.includeAliases && (
              <Badge variant="default" className="text-xs">
                Aliases
              </Badge>
            )}
            {subscription.includeMetadataMissing && (
              <Badge variant="secondary" className="text-xs">
                No Metadata
              </Badge>
            )}
            {studio && studio.rating > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Star className="h-3 w-3" />
                {studio.rating.toFixed(1)}
              </Badge>
            )}
            {studio?.parentStudioId && (
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="h-3 w-3" />
                Network
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(subscription.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
