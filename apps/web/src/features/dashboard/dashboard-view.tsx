"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  HardDrive,
  Film,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Download,
  DownloadCloud,
  Users,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Database,
  Cpu,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSubscriptions } from "@/features/subscriptions";
import { useUnifiedDownloads } from "@/features/downloads";
import { useTorrents } from "@/features/downloads";
import { useJobs } from "@/features/jobs";
import { useDashboardStatistics, useProviderStatus } from "./hooks";
import { formatBytes } from "@/features/downloads/components/utils";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated counter component for statistics
 */
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}

/**
 * Stat card component with gradient background
 */
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  gradient,
  isLoading,
}: {
  title: string;
  value: number;
  icon: any;
  trend?: "up" | "down";
  trendValue?: string;
  gradient: string;
  isLoading?: boolean;
}) {
  return (
    <Card className={cn("group overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]", gradient)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend && trendValue && (
            <Badge
              variant="secondary"
              className={cn(
                "bg-white/20 text-white border-0 backdrop-blur-sm",
                trend === "up" ? "text-green-100" : "text-red-100"
              )}
            >
              {trend === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trendValue}
            </Badge>
          )}
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-20 mt-4 bg-white/20" />
        ) : (
          <CardTitle className="text-3xl font-bold text-white mt-4">
            <AnimatedCounter value={value} />
          </CardTitle>
        )}
        <CardDescription className="text-white/80">{title}</CardDescription>
      </CardHeader>
    </Card>
  );
}

/**
 * Metric display component
 */
function MetricDisplay({
  label,
  value,
  icon: Icon,
  color = "default",
}: {
  label: string;
  value: string | number;
  icon?: any;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "default";
}) {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    purple: "text-purple-600 bg-purple-50",
    orange: "text-orange-600 bg-orange-50",
    red: "text-red-600 bg-red-50",
    default: "text-primary bg-muted",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      {Icon && <div className={cn("p-2 rounded-lg", colorClasses[color])}>{<Icon className="h-4 w-4" />}</div>}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

/**
 * Progress bar with percentage
 */
function ProgressWithLabel({
  value,
  max,
  label,
  color = "primary",
  showPercentage = true,
}: {
  value: number;
  max: number;
  label: string | null;
  color?: "primary" | "success" | "warning" | "danger";
  showPercentage?: boolean;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colorClasses = {
    primary: "bg-primary",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    danger: "bg-red-500",
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{label}</span>
          {showPercentage && <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>}
        </div>
      )}
      {!label && showPercentage && (
        <div className="flex items-center justify-end text-sm">
          <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
        </div>
      )}
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * @view DashboardView
 * @description Modern dashboard with enhanced UI/UX, animated statistics, and improved visual hierarchy
 */
export function DashboardView() {
  const { data: subscriptions, isLoading: loadingSubscriptions } = useSubscriptions();
  const { data: downloads, isLoading: loadingDownloads } = useUnifiedDownloads();
  const { data: torrents, isLoading: loadingTorrents } = useTorrents();
  const { data: jobs, isLoading: loadingJobs } = useJobs();
  const { data: stats, isLoading: loadingStats } = useDashboardStatistics();
  const { data: providerStatus } = useProviderStatus();
  const [volumesExpanded, setVolumesExpanded] = useState(false);

  const activeDownloads = downloads?.downloads?.filter((item) => item.status === "downloading").length || 0;
  const activeTorrents = torrents?.torrents?.length || 0;

  const recentJobs = jobs?.jobs
    ?.filter((j) => j.lastRun)
    ?.sort((a, b) => {
      const dateA = new Date(a.lastRun || 0).getTime();
      const dateB = new Date(b.lastRun || 0).getTime();
      return dateB - dateA;
    })
    ?.slice(0, 4) || [];

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

  const getJobIcon = (jobName: string) => {
    const iconMap: Record<string, any> = {
      "subscription-search": Users,
      "metadata-refresh": Database,
      "torrent-monitor": Download,
      "cleanup": Zap,
      "hash-generation": Activity,
    };
    return iconMap[jobName] || Clock;
  };

  // Helper functions for provider display
  const getProviderIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      "tpdb": Database,
      "stashdb": Globe,
      "prowlarr": Search,
      "jackett": Search,
      "qbittorrent": DownloadCloud,
      "transmission": DownloadCloud,
    };
    return iconMap[type] || Settings;
  };

  const getProviderStatusDisplay = (status: string) => {
    switch (status) {
      case "connected":
        return { status: "Connected", variant: "default" as const, className: "bg-green-500" };
      case "disconnected":
        return { status: "Disabled", variant: "secondary" as const };
      case "error":
        return { status: "Error", variant: "destructive" as const };
      default:
        return { status: "Unknown", variant: "secondary" as const };
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with gradient text */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome to Eros - Your automated content management hub
          </p>
        </div>
      </div>

      {/* Stats Cards with Gradients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Subscriptions"
          value={subscriptions?.data?.length || 0}
          icon={Users}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          isLoading={loadingSubscriptions}
        />
        <StatCard
          title="Total Downloads"
          value={downloads?.downloads?.length || 0}
          icon={Download}
          trend="up"
          trendValue="+12%"
          gradient="bg-gradient-to-br from-purple-500 to-purple-700"
          isLoading={loadingDownloads}
        />
        <StatCard
          title="Active Downloads"
          value={activeDownloads}
          icon={Activity}
          gradient="bg-gradient-to-br from-orange-500 to-orange-700"
          isLoading={loadingDownloads}
        />
        <StatCard
          title="Active Torrents"
          value={activeTorrents}
          icon={Zap}
          gradient="bg-gradient-to-br from-green-500 to-green-700"
          isLoading={loadingTorrents}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage & System Overview - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Storage Card */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <HardDrive className="h-6 w-6 text-blue-500" />
                </div>
                Storage Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingStats ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <>
                  <ProgressWithLabel
                    value={stats?.storage.usedDiskSpace || 0}
                    max={stats?.storage.totalDiskSpace || 1}
                    label="Disk Usage"
                    color={(stats?.storage.usagePercentage ?? 0) > 80 ? "danger" : (stats?.storage.usagePercentage ?? 0) > 60 ? "warning" : "primary"}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricDisplay
                      label="Used Space"
                      value={formatBytes(stats?.storage.usedDiskSpace || 0)}
                      icon={TrendingUp}
                      color="orange"
                    />
                    <MetricDisplay
                      label="Available"
                      value={formatBytes(stats?.storage.availableDiskSpace || 0)}
                      icon={TrendingDown}
                      color="green"
                    />
                    <MetricDisplay
                      label="Content Size"
                      value={formatBytes(stats?.storage.contentSize || 0)}
                      icon={Film}
                      color="purple"
                    />
                    <MetricDisplay
                      label="Total Capacity"
                      value={formatBytes(stats?.storage.totalDiskSpace || 0)}
                      icon={HardDrive}
                      color="blue"
                    />
                  </div>

                  {/* Individual Volumes - Expandable */}
                  {stats?.storage.volumes && stats.storage.volumes.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <button
                        onClick={() => setVolumesExpanded(!volumesExpanded)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                      >
                        <Clock
                          className={cn(
                            "h-4 w-4 transition-transform",
                            volumesExpanded && "rotate-90"
                          )}
                        />
                        <span>
                          {volumesExpanded ? "Hide" : "Show"} individual volumes ({stats.storage.volumes.length})
                        </span>
                      </button>

                      {volumesExpanded && (
                        <div className="mt-4 space-y-3">
                          {stats.storage.volumes.map((volume) => (
                            <div key={volume.path} className="p-3 rounded-lg bg-muted/50 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{volume.name}</span>
                                <span className="text-xs text-muted-foreground">{volume.path}</span>
                              </div>
                              <ProgressWithLabel
                                value={volume.used}
                                max={volume.total}
                                label={null}
                                color={volume.usagePercentage > 80 ? "danger" : volume.usagePercentage > 60 ? "warning" : "primary"}
                                showPercentage={true}
                              />
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Used: </span>
                                  {formatBytes(volume.used)}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Available: </span>
                                  {formatBytes(volume.available)}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Total: </span>
                                  {formatBytes(volume.total)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Content Statistics */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Film className="h-6 w-6 text-purple-500" />
                </div>
                Content Library
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingStats ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                      <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                        <AnimatedCounter value={stats?.content.totalScenes || 0} />
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Total Scenes</p>
                    </div>
                    <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                      <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                        <AnimatedCounter value={stats?.content.scenesWithFiles || 0} />
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Downloaded</p>
                    </div>
                    <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                      <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                        <AnimatedCounter value={stats?.content.totalFiles || 0} />
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">Total Files</p>
                    </div>
                  </div>

                  {stats?.content.qualityDistribution && stats.content.qualityDistribution.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Quality Distribution
                      </h3>
                      <div className="space-y-3">
                        {stats.content.qualityDistribution.slice(0, 5).map((q) => (
                          <div key={q.quality} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {q.quality}
                                </Badge>
                                <span className="text-muted-foreground">{q.count} files</span>
                              </div>
                              <span className="font-medium">{formatBytes(q.size)}</span>
                            </div>
                            <Progress
                              value={stats.content.totalFiles > 0 ? (q.count / stats.content.totalFiles) * 100 : 0}
                              className="h-2"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Clock className="h-6 w-6 text-orange-500" />
                  </div>
                  Recent Activity
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent Downloads */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Downloads
                  </h3>
                  {loadingDownloads ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (downloads?.downloads?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {downloads?.downloads?.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {item.sceneTitle}
                              </p>
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
                              className={cn(item.status === "completed" && "bg-green-500")}
                            >
                              {item.status}
                            </Badge>
                          </div>
                          {item.status === "downloading" && (
                            <Progress value={(item.progress || 0) * 100} className="h-1.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Download className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No downloads yet</p>
                    </div>
                  )}
                </div>

                {/* Active Torrents */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Torrents
                  </h3>
                  {loadingTorrents ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (torrents?.torrents?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {torrents?.torrents?.slice(0, 4).map((torrent) => (
                        <div
                          key={torrent.hash}
                          className="group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {torrent.name}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <ArrowDownRight className="h-3 w-3 text-green-500" />
                                  {torrent.dlspeed != null && torrent.dlspeed > 0
                                    ? `${(torrent.dlspeed / 1024 / 1024).toFixed(1)} MB/s`
                                    : "-"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <ArrowUpRight className="h-3 w-3 text-blue-500" />
                                  {torrent.upspeed != null && torrent.upspeed > 0
                                    ? `${(torrent.upspeed / 1024 / 1024).toFixed(1)} MB/s`
                                    : "-"}
                                </span>
                              </div>
                            </div>
                            <Badge variant="secondary">{(torrent.progress * 100).toFixed(0)}%</Badge>
                          </div>
                          <Progress value={torrent.progress * 100} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No active torrents</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - System Status & Jobs */}
        <div className="space-y-6">
          {/* System Status */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Globe className="h-6 w-6 text-green-500" />
                </div>
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">API Server</span>
                </div>
                <Badge className="bg-green-500">Online</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <Badge className="bg-green-500">Connected</Badge>
              </div>

              {[
                {
                  title: "Metadata Providers",
                  providers: providerStatus?.metadataProviders || [],
                  icon: Database,
                },
                {
                  title: "Indexers",
                  providers: providerStatus?.indexers || [],
                  icon: Search,
                },
                {
                  title: "Torrent Clients",
                  providers: providerStatus?.torrentClients || [],
                  icon: DownloadCloud,
                },
              ].map((group) => (
                <div key={group.title}>
                  {group.providers.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-3">
                        {group.title}
                      </div>
                      {group.providers.map((provider) => {
                        const ProviderIcon = getProviderIcon(provider.type);
                        const statusDisplay = getProviderStatusDisplay(provider.status);
                        return (
                          <div
                            key={provider.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg mb-2",
                              provider.status === "connected"
                                ? "bg-green-50 dark:bg-green-950"
                                : "bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <ProviderIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{provider.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {provider.type}
                              </Badge>
                            </div>
                            <Badge variant={statusDisplay.variant} className={statusDisplay.className}>
                              {statusDisplay.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {group.providers.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      No {group.title.toLowerCase()} configured
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Cpu className="h-6 w-6 text-blue-500" />
                  </div>
                  Jobs
                </CardTitle>
                <Link href="/jobs">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View All
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingJobs ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentJobs.length > 0 ? (
                <div className="space-y-3">
                  {recentJobs.map((job) => {
                    const JobIcon = getJobIcon(job.name);
                    return (
                      <div
                        key={job.name}
                        className="group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              job.status === "completed"
                                ? "bg-green-500/10"
                                : job.status === "running"
                                ? "bg-blue-500/10"
                                : job.status === "failed"
                                ? "bg-red-500/10"
                                : "bg-muted"
                            )}
                          >
                            <JobIcon
                              className={cn(
                                "h-4 w-4",
                                job.status === "completed"
                                  ? "text-green-500"
                                  : job.status === "running"
                                  ? "text-blue-500 animate-pulse"
                                  : job.status === "failed"
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{getJobDisplayName(job.name)}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.lastRun
                                ? formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })
                                : "Never"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "default"
                                : job.status === "running"
                                ? "secondary"
                                : job.status === "failed"
                                ? "destructive"
                                : "outline"
                            }
                            className={cn(job.status === "completed" && "bg-green-500")}
                          >
                            {job.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Cpu className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No job history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
