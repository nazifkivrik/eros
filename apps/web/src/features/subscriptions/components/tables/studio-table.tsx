/**
 * Studio Table Component
 * Presentational component for displaying studio subscriptions in table format
 */

import type { SubscriptionDetail } from "@repo/shared-types";
import { Trash2 } from "lucide-react";
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

interface StudioTableProps {
  subscriptions: SubscriptionDetail[];
  onDelete: (subscription: SubscriptionDetail, e: React.MouseEvent) => void;
  isDeletePending?: boolean;
}

export function StudioTable({ subscriptions, onDelete, isDeletePending }: StudioTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Quality Profile</TableHead>
            <TableHead>Auto Download</TableHead>
            <TableHead>Include Aliases</TableHead>
            <TableHead>Subscribed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => (window.location.href = `/subscriptions/${sub.id}`)}
            >
              <TableCell className="font-medium">{sub.entityName}</TableCell>
              <TableCell>{sub.qualityProfile?.name || "N/A"}</TableCell>
              <TableCell>
                <Badge variant={sub.autoDownload ? "default" : "outline"}>
                  {sub.autoDownload ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={sub.includeAliases ? "default" : "outline"}>
                  {sub.includeAliases ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => onDelete(sub, e)}
                  disabled={isDeletePending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
