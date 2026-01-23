/**
 * Scene Card Component
 * Presentational component for displaying a scene subscription
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubscriptionImage } from "@/components/subscriptions/SubscriptionImage";
import { cn } from "@/lib/utils";

interface SceneCardProps {
  subscription: SubscriptionDetail;
  onToggleSubscribe: (subscription: SubscriptionDetail, e: React.MouseEvent) => void;
}

export function SceneCard({ subscription, onToggleSubscribe }: SceneCardProps) {
  // Helper to get the best image URL from entity data
  const getEntityImageUrl = (entity: any): string | null => {
    if (!entity) return null;

    // Prefer background (landscape)
    if (entity.background) {
      if (typeof entity.background === "object") {
        return entity.background.full || entity.background.large || Object.values(entity.background)[0];
      }
      return entity.background;
    }
    if (entity.background_back) {
      if (typeof entity.background_back === "object") {
        return entity.background_back.full || entity.background_back.large || Object.values(entity.background_back)[0];
      }
      return entity.background_back;
    }
    if (entity.image) return entity.image;
    if (entity.back_image) return entity.back_image;

    // Check images array
    const images = entity.images
      ? typeof entity.images === "string"
        ? JSON.parse(entity.images)
        : entity.images
      : [];

    if (images.length > 0) {
      const backgroundImg = images.find((img: any) =>
        img.url?.includes("/background/") || img.type === "background"
      );
      if (backgroundImg) return backgroundImg.url;
      if (images[0]?.url) return images[0].url;
    }

    // Fallback to poster
    if (entity.poster) return entity.poster;

    return null;
  };

  return (
    <Link href={`/subscriptions/${subscription.id}`}>
      <Card
        className={cn(
          "cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden",
          !subscription.isSubscribed && "opacity-60 grayscale-[50%]"
        )}
      >
        <SubscriptionImage
          src={getEntityImageUrl(subscription.entity)}
          alt={subscription.entityName}
          type="scene"
        />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate text-sm">{subscription.entityName}</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {subscription.qualityProfile?.name || "No quality profile"}
              </CardDescription>
            </div>
            <Button
              variant={subscription.isSubscribed ? "ghost" : "default"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => onToggleSubscribe(subscription, e)}
              title={subscription.isSubscribed ? "Unsubscribe" : "Resubscribe"}
            >
              {subscription.isSubscribed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex gap-1 flex-wrap text-xs">
            <Badge
              variant={subscription.isSubscribed ? "default" : "secondary"}
              className={cn(
                "text-xs",
                subscription.isSubscribed ? "bg-green-600" : "bg-muted text-muted-foreground"
              )}
            >
              {subscription.isSubscribed ? "✓ Active" : "○ Inactive"}
            </Badge>
            <Badge
              variant={subscription.autoDownload ? "default" : "outline"}
              className="text-xs"
            >
              Auto: {subscription.autoDownload ? "On" : "Off"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(subscription.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
