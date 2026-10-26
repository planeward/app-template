"use client";

import { useViewerClaims } from "@/lib/use-viewer-claims";

import { AnnounceCard } from "./announce-card";
import { Board } from "./board";
import { FrameGate } from "./frame-gate";
import { ViewerCard } from "./viewer-card";

function ExperienceContent() {
  // Role from the token payload decides what to show; the API enforces it.
  const claims = useViewerClaims();
  return (
    <>
      <ViewerCard />
      <Board />
      {claims?.role === "admin" ? <AnnounceCard /> : null}
    </>
  );
}

export function ExperienceView() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <FrameGate>
        <ExperienceContent />
      </FrameGate>
    </main>
  );
}
