import { Suspense, use } from "react";
import { SubscriptionDetailView } from "@/features/subscriptions";

interface PageProps {
  params: Promise<{ id: string }>;
}

function SubscriptionDetailPageContent({ params }: PageProps) {
  const { id } = use(params);
  return <SubscriptionDetailView id={id} />;
}

export default function SubscriptionDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <SubscriptionDetailPageContent params={params} />
    </Suspense>
  );
}
