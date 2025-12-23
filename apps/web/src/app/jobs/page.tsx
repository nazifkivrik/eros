"use client";

import { Play, Clock, CheckCircle2, XCircle, AlertCircle, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobs, useTriggerJob } from "@/hooks/useJobs";
import { useJobProgress } from "@/hooks/use-job-progress";
import { formatDistanceToNow } from "date-fns";

const JOB_INFO = {
  "subscription-search": {
    name: "Subscription Search",
    description: "Search for new content from subscribed performers and studios",
    schedule: "Every 6 hours",
  },
  "metadata-refresh": {
    name: "Metadata Refresh",
    description: "Update and fix missing metadata for scenes from StashDB and TPDB",
    schedule: "Daily at 2:00 AM",
  },
  "torrent-monitor": {
    name: "Torrent Monitor",
    description: "Monitor torrent downloads and handle completions",
    schedule: "Every 5 minutes",
  },
  "cleanup": {
    name: "Cleanup",
    description: "Remove old logs and cleanup temporary files",
    schedule: "Weekly on Sunday at 3:00 AM",
  },
  "hash-generation": {
    name: "Hash Generation",
    description: "Generate OSHASH for video files without hashes",
    schedule: "Daily at 5:00 AM",
  },
};

export default function JobsPage() {
  const { data: jobs, isLoading } = useJobs();
  const triggerJob = useTriggerJob();
  const { isConnected, getLatestJobEvent, isJobRunning } = useJobProgress();

  const handleTrigger = (jobName: string) => {
    triggerJob.mutate(jobName);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "running":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Running
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Background Jobs</h1>
            <p className="text-muted-foreground">
              Monitor and manually trigger scheduled background tasks
            </p>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
            <Activity className="h-3 w-3" />
            {isConnected ? "Live Updates Active" : "Connecting..."}
          </Badge>
        </div>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : !jobs?.jobs || jobs.jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <p>No jobs configured. Jobs will appear here once they are registered.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {Object.entries(JOB_INFO).map(([jobKey, jobInfo]) => {
            const job = jobs.jobs.find((j: any) => j.name === jobKey);
            const jobEvent = getLatestJobEvent(jobKey);
            const running = isJobRunning(jobKey);

            return (
              <Card key={jobKey}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {jobInfo.name}
                        {running && (
                          <Badge variant="secondary" className="gap-1 animate-pulse">
                            <Clock className="h-3 w-3" />
                            Running
                          </Badge>
                        )}
                        {!running && job && getStatusBadge(job.status)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {jobInfo.description}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleTrigger(jobKey)}
                      disabled={triggerJob.isPending || running}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Trigger Now
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Real-time Progress */}
                  {running && jobEvent?.progress && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{jobEvent.message}</span>
                        <span className="font-medium">{jobEvent.progress.percentage}%</span>
                      </div>
                      <Progress value={jobEvent.progress.percentage} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Processing {jobEvent.progress.current} of {jobEvent.progress.total}
                        </span>
                        {jobEvent.data?.entityName && (
                          <span>Current: {jobEvent.data.entityName}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Schedule:</span>{" "}
                      <span className="font-medium">{jobInfo.schedule}</span>
                    </div>
                    {job?.lastRun && (
                      <div>
                        <span className="text-muted-foreground">Last Run:</span>{" "}
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {job?.nextRun && (
                      <div>
                        <span className="text-muted-foreground">Next Run:</span>{" "}
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Show completed/failed status from live events */}
                  {jobEvent?.status === "completed" && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Completed
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {jobEvent.message}
                        </p>
                      </div>
                    </div>
                  )}
                  {jobEvent?.status === "failed" && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                          Failed
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {jobEvent.message}
                        </p>
                      </div>
                    </div>
                  )}
                  {job?.error && !jobEvent && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                          Error
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {job.error}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Job History (if available) */}
      {jobs?.jobs && jobs.jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Job Executions</CardTitle>
            <CardDescription>
              History of the latest job runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.jobs.filter((j: any) => j.lastRun).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.jobs
                    .filter((j: any) => j.lastRun)
                    .map((job: any) => (
                      <TableRow key={job.name}>
                        <TableCell className="font-medium">
                          {JOB_INFO[job.name as keyof typeof JOB_INFO]?.name || job.name}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>
                          {job.lastRun
                            ? formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          {job.completedAt
                            ? formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })
                            : job.status === "running"
                            ? "In progress"
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {job.duration ? `${(job.duration / 1000).toFixed(2)}s` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No job history available yet. Jobs will appear here after they run.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
