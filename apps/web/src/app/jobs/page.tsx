import { JobsView } from "@/features/jobs";

/**
 * Jobs Page
 * Pure routing - delegates to JobsView
 * No business logic or data fetching
 */
export default function JobsPage() {
  return <JobsView />;
}
