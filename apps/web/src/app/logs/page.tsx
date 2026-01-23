import { LogsView } from "@/features/logs";

/**
 * Logs Page
 * Pure routing - delegates to LogsView
 * No business logic or data fetching
 */
export default function LogsPage() {
  return <LogsView />;
}
