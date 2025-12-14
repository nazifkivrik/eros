"use client";

import { Play, Clock, CheckCircle2, XCircle, AlertCircle, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    description: "Update metadata for scenes from StashDB",
    schedule: "Daily at 2:00 AM",
  },
  "cleanup-old-logs": {
    name: "Cleanup Old Logs",
    description: "Remove logs older than 30 days",
    schedule: "Daily at 3:00 AM",
  },
  "check-downloads": {
    name: "Check Downloads",
    description: "Verify download status and update queue",
    schedule: "Every hour",
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
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No jobs configured. Jobs will appear here once they are registered.
          </AlertDescription>
        </Alert>
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
                    <Alert className="mt-4">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Completed:</strong> {jobEvent.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  {jobEvent?.status === "failed" && (
                    <Alert variant="destructive" className="mt-4">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Failed:</strong> {jobEvent.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  {job?.error && !jobEvent && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Error:</strong> {job.error}
                      </AlertDescription>
                    </Alert>
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
              History of the last 10 job runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.jobs
                  .filter((j: any) => j.lastRun)
                  .slice(0, 10)
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
                        {job.duration ? `${job.duration}ms` : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {job.result || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
