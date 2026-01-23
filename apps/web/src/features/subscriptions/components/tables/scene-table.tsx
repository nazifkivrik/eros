/**
 * Scene Table Component
 * Presentational component for displaying scene subscriptions in table format
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SceneTableProps {
  subscriptions: SubscriptionDetail[];
  onToggleSubscribe: (subscription: SubscriptionDetail, e: React.MouseEvent) => void;
}

export function SceneTable({ subscriptions, onToggleSubscribe }: SceneTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Quality Profile</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => (
            <TableRow
              key={sub.id}
              className={cn(
                "cursor-pointer hover:bg-accent/50",
                !sub.isSubscribed && "opacity-60 bg-muted/30"
              )}
              onClick={() => (window.location.href = `/subscriptions/${sub.id}`)}
            >
              <TableCell className="font-medium">{sub.entityName}</TableCell>
              <TableCell>{sub.qualityProfile?.name || "N/A"}</TableCell>
              <TableCell>
                <Badge
                  variant={sub.isSubscribed ? "default" : "secondary"}
                  className={cn(
                    sub.isSubscribed ? "bg-green-600" : "bg-muted text-muted-foreground"
                  )}
                >
                  {sub.isSubscribed ? "✓ Active" : "○ Inactive"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant={sub.isSubscribed ? "ghost" : "default"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => onToggleSubscribe(sub, e)}
                  title={sub.isSubscribed ? "Unsubscribe" : "Resubscribe"}
                >
                  {sub.isSubscribed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
