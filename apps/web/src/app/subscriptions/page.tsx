"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {  Users, Building2, Film, Trash2, AlertCircle, LayoutGrid, List } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSubscriptions, useDeleteSubscription } from "@/hooks/useSubscriptions";

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState("performers");
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [unsubscribeDialog, setUnsubscribeDialog] = useState<{
    open: boolean;
    subscription: any | null;
  }>({ open: false, subscription: null });
  const { data: subscriptions, isLoading } = useSubscriptions();
  const deleteSubscription = useDeleteSubscription();

  const performers = subscriptions?.data?.filter((s: any) => s.entityType === "performer") || [];
  const studios = subscriptions?.data?.filter((s: any) => s.entityType === "studio") || [];
  const scenes = subscriptions?.data?.filter((s: any) => s.entityType === "scene") || [];

  const handleUnsubscribeClick = (subscription: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For scenes, just delete directly
    if (subscription.entityType === "scene") {
      deleteSubscription.mutate({ id: subscription.id });
      return;
    }

    // For performers/studios, show dialog to ask about associated scenes
    setUnsubscribeDialog({ open: true, subscription });
  };

  const handleConfirmUnsubscribe = (deleteAssociatedScenes: boolean) => {
    if (unsubscribeDialog.subscription) {
      deleteSubscription.mutate({
        id: unsubscribeDialog.subscription.id,
        deleteAssociatedScenes,
      });
      setUnsubscribeDialog({ open: false, subscription: null });
    }
  };

  const renderPerformersTable = () => (
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
          {performers.map((sub: any) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => window.location.href = `/subscriptions/${sub.id}`}
            >
              <TableCell className="font-medium">
                {sub.entityName}
              </TableCell>
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
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleUnsubscribeClick(sub, e)}
                    disabled={deleteSubscription.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderPerformersCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {performers.map((sub: any) => {
        const images = sub.entity?.images ? (typeof sub.entity.images === 'string' ? JSON.parse(sub.entity.images) : sub.entity.images) : [];
        const imageUrl = images[0]?.url || null;
        return (
          <Link key={sub.id} href={`/subscriptions/${sub.id}`}>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden">
              {imageUrl && (
                <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
                  <Image
                    src={imageUrl}
                    alt={sub.entityName}
                    width={300}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-base">{sub.entityName}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {sub.qualityProfile?.name || "No quality profile"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => handleUnsubscribeClick(sub, e)}
                    disabled={deleteSubscription.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex gap-1 flex-wrap text-xs">
                  <Badge variant={sub.autoDownload ? "default" : "outline"} className="text-xs">
                    Auto: {sub.autoDownload ? "On" : "Off"}
                  </Badge>
                  <Badge variant={sub.includeAliases ? "default" : "outline"} className="text-xs">
                    Aliases
                  </Badge>
                  {sub.includeMetadataMissing && (
                    <Badge variant="secondary" className="text-xs">
                      No Metadata
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  const renderStudiosTable = () => (
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
          {studios.map((sub: any) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => window.location.href = `/subscriptions/${sub.id}`}
            >
              <TableCell className="font-medium">
                {sub.entityName}
              </TableCell>
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
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  disabled={deleteSubscription.isPending}
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

  const renderStudiosCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {studios.map((sub: any) => {
        const images = sub.entity?.images ? (typeof sub.entity.images === 'string' ? JSON.parse(sub.entity.images) : sub.entity.images) : [];
        const imageUrl = images[0]?.url || null;
        return (
          <Link key={sub.id} href={`/subscriptions/${sub.id}`}>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden">
              {imageUrl && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <Image
                    src={imageUrl}
                    alt={sub.entityName}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-base">{sub.entityName}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {sub.qualityProfile?.name || "No quality profile"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => handleUnsubscribeClick(sub, e)}
                    disabled={deleteSubscription.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex gap-1 flex-wrap text-xs">
                  <Badge variant={sub.autoDownload ? "default" : "outline"} className="text-xs">
                    Auto: {sub.autoDownload ? "On" : "Off"}
                  </Badge>
                  <Badge variant={sub.includeAliases ? "default" : "outline"} className="text-xs">
                    Aliases
                  </Badge>
                  {sub.includeMetadataMissing && (
                    <Badge variant="secondary" className="text-xs">
                      No Metadata
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  const renderScenesTable = () => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Quality Profile</TableHead>
            <TableHead>Auto Download</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Subscribed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenes.map((sub: any) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => window.location.href = `/subscriptions/${sub.id}`}
            >
              <TableCell className="font-medium">
                {sub.entityName}
              </TableCell>
              <TableCell>{sub.qualityProfile?.name || "N/A"}</TableCell>
              <TableCell>
                <Badge variant={sub.autoDownload ? "default" : "outline"}>
                  {sub.autoDownload ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                  {sub.status}
                </Badge>
              </TableCell>
              <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleUnsubscribeClick(sub, e)}
                  disabled={deleteSubscription.isPending}
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

  const renderScenesCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {scenes.map((sub: any) => {
        const images = sub.entity?.images ? (typeof sub.entity.images === 'string' ? JSON.parse(sub.entity.images) : sub.entity.images) : [];
        const imageUrl = images[0]?.url || null;
        return (
          <Link key={sub.id} href={`/subscriptions/${sub.id}`}>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full overflow-hidden">
              {imageUrl && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <Image
                    src={imageUrl}
                    alt={sub.entityName}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-sm">{sub.entityName}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {sub.qualityProfile?.name || "No quality profile"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => handleUnsubscribeClick(sub, e)}
                    disabled={deleteSubscription.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex gap-1 flex-wrap text-xs">
                  <Badge variant={sub.status === "active" ? "default" : "secondary"} className="text-xs">
                    {sub.status}
                  </Badge>
                  <Badge variant={sub.autoDownload ? "default" : "outline"} className="text-xs">
                    Auto: {sub.autoDownload ? "On" : "Off"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage your performer, studio, and scene subscriptions
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === "card" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("card")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-bold">{performers.length}</CardTitle>
            </div>
            <CardDescription>Performer Subscriptions</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-bold">{studios.length}</CardTitle>
            </div>
            <CardDescription>Studio Subscriptions</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-bold">{scenes.length}</CardTitle>
            </div>
            <CardDescription>Scene Subscriptions</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="performers">Performers ({performers.length})</TabsTrigger>
          <TabsTrigger value="studios">Studios ({studios.length})</TabsTrigger>
          <TabsTrigger value="scenes">Scenes ({scenes.length})</TabsTrigger>
        </TabsList>

        {/* Performers Tab */}
        <TabsContent value="performers" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : performers.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No performer subscriptions yet. Search and subscribe to performers to start tracking their content.
              </AlertDescription>
            </Alert>
          ) : (
            viewMode === "table" ? renderPerformersTable() : renderPerformersCards()
          )}
        </TabsContent>

        {/* Studios Tab */}
        <TabsContent value="studios" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : studios.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No studio subscriptions yet. Search and subscribe to studios to start tracking their content.
              </AlertDescription>
            </Alert>
          ) : (
            viewMode === "table" ? renderStudiosTable() : renderStudiosCards()
          )}
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : scenes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No scene subscriptions yet. Scene subscriptions are automatically created when you subscribe to performers or studios.
              </AlertDescription>
            </Alert>
          ) : (
            viewMode === "table" ? renderScenesTable() : renderScenesCards()
          )}
        </TabsContent>
      </Tabs>

      {/* Unsubscribe Confirmation Dialog */}
      <Dialog open={unsubscribeDialog.open} onOpenChange={(open) => !open && setUnsubscribeDialog({ open: false, subscription: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsubscribe Confirmation</DialogTitle>
            <DialogDescription>
              You are about to unsubscribe from{" "}
              <strong>{unsubscribeDialog.subscription?.entityName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This {unsubscribeDialog.subscription?.entityType} has associated scene subscriptions.
              Would you like to remove those as well?
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setUnsubscribeDialog({ open: false, subscription: null })}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleConfirmUnsubscribe(false)}
              disabled={deleteSubscription.isPending}
            >
              Keep Scenes
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleConfirmUnsubscribe(true)}
              disabled={deleteSubscription.isPending}
            >
              Remove All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
