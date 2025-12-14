"use client";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Check } from "lucide-react";

interface SubscriptionFooterProps {
  isSubscribed: boolean;
  subscription?: {
    qualityProfile?: { name: string };
    autoDownload: boolean;
  };
  onClose: () => void;
  onSubscribe: () => void;
}

export function SubscriptionFooter({
  isSubscribed,
  subscription,
  onClose,
  onSubscribe,
}: SubscriptionFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      {!isSubscribed && (
        <Button onClick={onSubscribe}>
          Subscribe
        </Button>
      )}
      {isSubscribed && subscription && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-green-600" />
          <span>
            Subscribed with {subscription.qualityProfile?.name || 'profile'}
            {subscription.autoDownload && ' - Auto Download'}
          </span>
        </div>
      )}
    </DialogFooter>
  );
}
