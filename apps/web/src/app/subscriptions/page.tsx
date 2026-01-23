/**
 * Subscriptions Page
 * Routing only - delegates to SubscriptionsView
 * Follows Clean Architecture: Page → View → Components
 */

import { SubscriptionsView } from "@/features/subscriptions";

export default function SubscriptionsPage() {
  return <SubscriptionsView />;
}
