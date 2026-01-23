"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import type { Job } from "./job-card";

type JobInfoMap = Record<string, { name: string; description: string; schedule: string }>;

type Props = {
  jobs: Job[];
  jobInfoMap: JobInfoMap;
};

/**
 * Status Badge Component
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="default" className="gap-1">Completed</Badge>;
    case "running":
      return <Badge variant="secondary" className="gap-1">Running</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1">Failed</Badge>;
    default:
      return <Badge variant="outline" className="gap-1">{status}</Badge>;
  }
}

/**
 * Job History Table Component
 * Displays history of job executions
 */
export function JobHistoryTable({ jobs, jobInfoMap }: Props) {
  const jobsWithHistory = jobs.filter((j) => j.lastRun);

  if (jobsWithHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Job Executions</CardTitle>
          <CardDescription>History of the latest job runs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No job history available yet. Jobs will appear here after they run.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Job Executions</CardTitle>
        <CardDescription>History of the latest job runs</CardDescription>
      </CardHeader>
      <CardContent>
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
            {jobsWithHistory.map((job) => (
              <TableRow key={job.name}>
                <TableCell className="font-medium">
                  {jobInfoMap[job.name]?.name || job.name}
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
                <TableCell>{job.duration ? `${(job.duration / 1000).toFixed(2)}s` : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
