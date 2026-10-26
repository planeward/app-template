"use client";

import { Skeleton } from "@repo/ui/components/skeleton";

import type { InstallationJson, WebhookDeliveryJson } from "@/lib/types";
import { useViewerJson } from "@/lib/use-viewer-json";

import { DeliveriesCard } from "./deliveries-card";
import { InstallationCard } from "./installation-card";

type DashboardResponse = {
  data: {
    installation: InstallationJson | null;
    deliveries: WebhookDeliveryJson[];
  };
};

export function DashboardOverview() {
  const result = useViewerJson<DashboardResponse>("/api/dashboard");

  if (result.status === "loading") {
    return (
      <>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </>
    );
  }

  if (result.status === "error") {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }

  return (
    <>
      <InstallationCard installation={result.data.data.installation} />
      <DeliveriesCard deliveries={result.data.data.deliveries} />
    </>
  );
}
