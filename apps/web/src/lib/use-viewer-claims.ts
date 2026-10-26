"use client";

import { useEffect, useState } from "react";

import type { AppViewerTokenClaims } from "@planeward/sdk/server";
import { usePlaneward } from "@repo/planeward/client";

export type ViewerClaims = Pick<
  AppViewerTokenClaims,
  "sub" | "name" | "avatar" | "role" | "channelId" | "view" | "exp"
>;

/**
 * Decode the viewer token payload for display only. The signature is not
 * checked here; the server verifies every token before trusting it.
 */
export function decodeViewerToken(token: string): ViewerClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as ViewerClaims;
  } catch {
    return null;
  }
}

const REFRESH_MS = 15_000;

/**
 * The current viewer's claims, re-read through `getToken` so a refreshed token
 * (new `exp`) shows up. UI hints only: never use these for authorization.
 */
export function useViewerClaims(): ViewerClaims | null {
  const { status, getToken } = usePlaneward();
  const [claims, setClaims] = useState<ViewerClaims | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    async function read() {
      try {
        const token = await getToken();
        if (!cancelled) setClaims(decodeViewerToken(token));
      } catch {
        // The provider surfaces token errors through `status`.
      }
    }

    void read();
    const interval = window.setInterval(read, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [status, getToken]);

  return claims;
}
