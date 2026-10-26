"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { useViewerFetch } from "@repo/planeward/client";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";

import { readError } from "@/lib/api";

/** Staff only. The server re-checks the role on every request. */
export function AnnounceCard() {
  const viewerFetch = useViewerFetch();
  const [channelId, setChannelId] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const toastId = toast.loading("Posting…");
      const response = await viewerFetch("/api/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelId.trim(),
          body: body.trim(),
        }),
      });
      if (!response.ok) {
        toast.error(await readError(response), { id: toastId });
        return;
      }
      toast.success("Posted as the app", { id: toastId });
      setBody("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Announce as the app</CardTitle>
        <CardDescription>
          Posts a message through the Planeward API. The target must be a text
          channel where @everyone can send.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announce-channel">Channel id</Label>
            <Input
              id="announce-channel"
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              placeholder="Text channel id"
              className="font-mono"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announce-body">Message</Label>
            <Textarea
              id="announce-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              rows={3}
              required
            />
          </div>
          <Button
            type="submit"
            className="self-end"
            disabled={isPending || !channelId.trim() || !body.trim()}
          >
            {isPending ? "Posting…" : "Post message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
