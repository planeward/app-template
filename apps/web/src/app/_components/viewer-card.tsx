"use client";

import { useEffect, useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useViewerClaims } from "@/lib/use-viewer-claims";

function useSecondsUntil(epochSeconds: number | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  if (epochSeconds === undefined) return null;
  return Math.max(0, Math.floor(epochSeconds - now / 1000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ViewerCard() {
  const claims = useViewerClaims();
  const secondsLeft = useSecondsUntil(claims?.exp);

  if (!claims) return <Skeleton className="h-28 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        {claims.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- host-provided URL on any domain
          <img
            src={claims.avatar}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="bg-muted flex size-12 items-center justify-center rounded-full text-lg font-medium"
          >
            {claims.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">{claims.name}</CardTitle>
          <CardDescription>Signed in through Planeward</CardDescription>
        </div>
        <Badge
          className="ml-auto"
          variant={claims.role === "admin" ? "default" : "secondary"}
        >
          {claims.role}
        </Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Channel</dt>
          <dd className="truncate font-mono">{claims.channelId ?? "—"}</dd>
          <dt className="text-muted-foreground">Token expires in</dt>
          <dd className="font-mono tabular-nums">
            {secondsLeft === null ? "—" : formatCountdown(secondsLeft)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
