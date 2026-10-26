"use client";

import Link from "next/link";

import { usePlaneward } from "@repo/planeward/client";
import { buttonVariants } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

/**
 * Renders `children` once the Planeward handshake is ready, and a clear state
 * for every other status (outside an iframe, connecting, error).
 */
export function FrameGate({ children }: { children: React.ReactNode }) {
  const { status, error } = usePlaneward();

  if (status === "ready") return children;

  if (status === "connecting") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Connecting to Planeward…</span>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "not-framed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open this inside a Planeward community</CardTitle>
          <CardDescription>
            This page only works in the Planeward iframe, where the host hands
            it a signed viewer token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go to setup
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card role="alert" className="border-destructive/50">
      <CardHeader>
        <CardTitle>Could not connect to Planeward</CardTitle>
        <CardDescription className="break-words">
          {error ?? "Unknown error."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
