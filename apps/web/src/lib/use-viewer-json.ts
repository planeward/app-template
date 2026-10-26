"use client";

import { useEffect, useState } from "react";

import { useViewerFetch } from "@repo/planeward/client";

import { readError } from "./api";

export type ViewerJson<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ok"; data: T };

/** GET a JSON endpoint of this app with the viewer token, once on mount. */
export function useViewerJson<T>(url: string): ViewerJson<T> {
  const viewerFetch = useViewerFetch();
  const [state, setState] = useState<ViewerJson<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await viewerFetch(url);
        if (!response.ok) throw new Error(await readError(response));
        const data = (await response.json()) as T;
        if (!cancelled) setState({ status: "ok", data });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, viewerFetch]);

  return state;
}
