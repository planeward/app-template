"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useViewerClaims } from "@/lib/use-viewer-claims";

import { DashboardOverview } from "./dashboard-overview";
import { FrameGate } from "./frame-gate";
import { MembersCard } from "./members-card";

function DashboardContent() {
  // UI gate only; every dashboard API route also requires role "admin".
  const claims = useViewerClaims();

  if (!claims) return <Skeleton className="h-48 w-full" />;

  if (claims.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff only</CardTitle>
          <CardDescription>
            The dashboard is for workspace staff.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <DashboardOverview />
      <MembersCard />
    </>
  );
}

export function DashboardView() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <FrameGate>
        <DashboardContent />
      </FrameGate>
    </main>
  );
}
