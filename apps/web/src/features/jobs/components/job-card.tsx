"use client";

import { Play, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import type { JobProgressEvent } from "@repo/shared-types";

export type JobInfo = {
  name: string;
  description: string;
  schedule: string;
};

export type Job = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string;
  status: string;
  enabled: boolean;
  error: string | null;
  completedAt: string | null;
  duration: number | null;
};

type Props = {
  jobKey: string;
  jobInfo: JobInfo;
  job?: Job;
  jobEvent: JobProgressEvent | null;
  isRunning: boolean;
  isPending: boolean;
  onTrigger: (jobName: string) => void;
};

/**
 * Next Execution Badge Component
 * Shows countdown until next job run
 */
function NextExecutionBadge({
  nextRun,
  status,
}: {
  nextRun: string | Date | null;
  status: string;
}) {
  const [timeUntil, setTimeUntil] = useState("");

  useEffect(() => {
    if (!nextRun || status === "running") {
      setTimeUntil("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const next = typeof nextRun === "string" ? new Date(nextRun) : nextRun;
      const diff = next.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntil("Starting soon");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeUntil(`in ${days}d`);
      } else if (hours > 0) {
        setTimeUntil(`in ${hours}h ${minutes}m`);
      } else {
        setTimeUntil(`in ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextRun, status]);

  if (status === "running") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Running
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }

  if (timeUntil) {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Next: {timeUntil}
      </Badge>
    );
  }

  return null;
}

/**
 * Job Card Component
 * Displays job information, status, and progress
 */
export function JobCard({ jobKey, jobInfo, job, jobEvent, isRunning, isPending, onTrigger }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {jobInfo.name}
              {isRunning && (
                <Badge variant="secondary" className="gap-1 animate-pulse">
                  <Clock className="h-3 w-3" />
                  Running
                </Badge>
              )}
              {!isRunning && (
                <NextExecutionBadge nextRun={job?.nextRun || null} status={job?.status || "idle"} />
              )}
            </CardTitle>
            <CardDescription className="mt-1">{jobInfo.description}</CardDescription>
          </div>
          <Button size="sm" onClick={() => onTrigger(jobKey)} disabled={isPending || isRunning}>
            <Play className="h-4 w-4 mr-2" />
            Trigger Now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Real-time Progress */}
        {isRunning && jobEvent?.progress && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{jobEvent.message}</span>
              <span className="font-medium">{jobEvent.progress.percentage}%</span>
            </div>
            <Progress value={jobEvent.progress.percentage} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Processing {jobEvent.progress.current} of {jobEvent.progress.total}</span>
              {jobEvent.data && typeof jobEvent.data === "object" && "entityName" in jobEvent.data && (
                <span>Current: {String(jobEvent.data.entityName)}</span>
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
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Completed</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">{jobEvent.message}</p>
            </div>
          </div>
        )}
        {jobEvent?.status === "failed" && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">Failed</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{jobEvent.message}</p>
            </div>
          </div>
        )}
        {job?.error && !jobEvent && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{job.error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
