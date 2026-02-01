"use client";

import { useJobs, useTriggerJob } from "./hooks/use-jobs";
import { useJobProgress } from "./hooks/use-job-progress";
import { JobsHeader } from "./components/jobs-header";
import { JobCard, type JobInfo } from "./components/job-card";
import { JobsSkeleton } from "./components/jobs-skeleton";
import { JobsEmpty } from "./components/jobs-empty";
import { JobHistoryTable } from "./components/job-history-table";

const JOB_INFO: Record<string, JobInfo> = {
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
};

/**
 * Jobs View
 * Composes jobs UI components and manages data fetching
 * Handles state orchestration but no direct UI rendering
 * Clean, minimal design
 */
export function JobsView() {
  const { data: jobs, isLoading } = useJobs();
  const triggerJob = useTriggerJob();
  const { isConnected, getLatestJobEvent, isJobRunning } = useJobProgress();

  const handleTrigger = (jobName: string) => {
    triggerJob.mutate(jobName);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <JobsHeader isConnected={false} />
        <JobsSkeleton />
      </div>
    );
  }

  if (!jobs?.jobs || jobs.jobs.length === 0) {
    return (
      <div className="space-y-6">
        <JobsHeader isConnected={isConnected} />
        <JobsEmpty />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <JobsHeader isConnected={isConnected} />

      {/* Jobs List */}
      <div className="grid grid-cols-1 gap-4">
        {Object.entries(JOB_INFO).map(([jobKey, jobInfo]) => {
          const job = jobs.jobs.find((j) => j.name === jobKey);
          const jobEvent = getLatestJobEvent(jobKey);
          const running = isJobRunning(jobKey);

          return (
            <JobCard
              key={jobKey}
              jobKey={jobKey}
              jobInfo={jobInfo}
              job={job}
              jobEvent={jobEvent}
              isRunning={running}
              isPending={triggerJob.isPending}
              onTrigger={handleTrigger}
            />
          );
        })}
      </div>

      {/* Job History */}
      <JobHistoryTable jobs={jobs.jobs} jobInfoMap={JOB_INFO} />
    </div>
  );
}
