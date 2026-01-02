"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Play, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useUnifiedDownloads } from "@/hooks/useUnifiedDownloads";
import { useTorrents } from "@/hooks/useTorrents";
import { useJobs } from "@/hooks/useJobs";
import { useSettings } from "@/hooks/useSettings";
import { formatDistanceToNow } from "date-fns";

export default function HomePage() {
  const { data: subscriptions, isLoading: loadingSubscriptions } = useSubscriptions();
  const { data: downloads, isLoading: loadingDownloads } = useUnifiedDownloads();
  const { data: torrents, isLoading: loadingTorrents } = useTorrents();
  const { data: jobs, isLoading: loadingJobs } = useJobs();
  const { data: settings } = useSettings();

  const activeDownloads = downloads?.downloads?.filter(
    (item) => item.status === "downloading"
  ).length || 0;

  const activeTorrents = torrents?.torrents?.length || 0;

  const getServiceStatus = (service: string) => {
    if (!settings) return { status: "Not Configured", variant: "secondary" as const };

    const serviceConfig = (settings as any)[service];
    if (!serviceConfig) return { status: "Not Configured", variant: "secondary" as const };

    // Check if service has enabled property
    if (typeof serviceConfig === 'object' && 'enabled' in serviceConfig) {
      if (serviceConfig.enabled) {
        return { status: "Configured", variant: "default" as const, className: "bg-green-500" };
      }
    }

    return { status: "Not Configured", variant: "secondary" as const };
  };

  const recentJobs = jobs?.jobs
    ?.filter((j) => j.lastRun)
    ?.sort((a, b) => {
      const dateA = new Date(a.lastRun || 0).getTime();
      const dateB = new Date(b.lastRun || 0).getTime();
      return dateB - dateA;
    })
    ?.slice(0, 3) || [];

  // Map job names to display names
  const getJobDisplayName = (jobName: string) => {
    const nameMap: Record<string, string> = {
      "subscription-search": "Subscription Search",
      "metadata-refresh": "Metadata Refresh",
      "torrent-monitor": "Torrent Monitor",
      "cleanup": "Cleanup",
      "hash-generation": "Hash Generation",
    };
    return nameMap[jobName] || jobName;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Eros - Automated adult content management system
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            {loadingSubscriptions ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <CardTitle className="text-2xl font-bold">
                {subscriptions?.data?.length || 0}
              </CardTitle>
            )}
            <CardDescription>Active Subscriptions</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            {loadingDownloads ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <CardTitle className="text-2xl font-bold">
                {downloads?.downloads?.length || 0}
              </CardTitle>
            )}
            <CardDescription>Total Downloads</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            {loadingDownloads ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <CardTitle className="text-2xl font-bold">{activeDownloads}</CardTitle>
            )}
            <CardDescription>Active Downloads</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            {loadingTorrents ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <CardTitle className="text-2xl font-bold">{activeTorrents}</CardTitle>
            )}
            <CardDescription>Active Torrents</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Downloads */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Downloads</h2>
          <Card>
            <CardContent className="pt-6">
              {loadingDownloads ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-2 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : (downloads?.downloads?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {downloads?.downloads?.slice(0, 5).map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.sceneTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quality} • {(item.size / 1024 / 1024 / 1024).toFixed(2)} GB
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.status === "completed"
                              ? "default"
                              : item.status === "downloading"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {item.status === "downloading" && (
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${(item.progress || 0) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No downloads yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Torrents */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Active Torrents</h2>
          <Card>
            <CardContent className="pt-6">
              {loadingTorrents ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-2 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : (torrents?.torrents?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {torrents?.torrents?.slice(0, 5).map((torrent) => (
                    <div key={torrent.hash} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{torrent.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ↓ {(torrent.dlspeed / 1024 / 1024).toFixed(1)} MB/s •
                            ↑ {(torrent.upspeed / 1024 / 1024).toFixed(1)} MB/s
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {(torrent.progress * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${torrent.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active torrents
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Jobs Summary */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Jobs</h2>
          <Link href="/jobs">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            {loadingJobs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentJobs.length > 0 ? (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div key={job.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {job.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : job.status === "running" ? (
                        <Clock className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : job.status === "failed" ? (
                        <Play className="h-5 w-5 text-red-500" />
                      ) : (
                        <Play className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{getJobDisplayName(job.name)}</p>
                        <p className="text-xs text-muted-foreground">
                          Last run: {job.lastRun ? formatDistanceToNow(new Date(job.lastRun), { addSuffix: true }) : "Never"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        job.status === "completed" ? "default" :
                        job.status === "running" ? "secondary" :
                        job.status === "failed" ? "destructive" :
                        "outline"
                      }
                      className={job.status === "completed" ? "bg-green-500" : ""}
                    >
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No job history available yet. Jobs will appear here after they run.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <div>
        <h2 className="text-xl font-semibold mb-4">System Status</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <CardTitle className="text-base">All Systems Operational</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">API Server</span>
              <Badge variant="default" className="bg-green-500">Online</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Database</span>
              <Badge variant="default" className="bg-green-500">Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">StashDB</span>
              <Badge
                variant={getServiceStatus("stashdb").variant}
                className={getServiceStatus("stashdb").className}
              >
                {getServiceStatus("stashdb").status}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Prowlarr</span>
              <Badge
                variant={getServiceStatus("prowlarr").variant}
                className={getServiceStatus("prowlarr").className}
              >
                {getServiceStatus("prowlarr").status}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">qBittorrent</span>
              <Badge
                variant={getServiceStatus("qbittorrent").variant}
                className={getServiceStatus("qbittorrent").className}
              >
                {getServiceStatus("qbittorrent").status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
