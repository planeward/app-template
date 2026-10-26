"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

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
import { Label } from "@repo/ui/components/label";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";

import { readError } from "@/lib/api";
import type { PostJson } from "@/lib/types";

const MAX_LENGTH = 500;

export function Board() {
  const viewerFetch = useViewerFetch();
  const [posts, setPosts] = useState<PostJson[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const response = await viewerFetch("/api/posts");
      if (!response.ok) throw new Error(await readError(response));
      const { data } = (await response.json()) as { data: PostJson[] };
      setPosts(data);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [viewerFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;

    startTransition(async () => {
      const response = await viewerFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!response.ok) {
        toast.error(await readError(response));
        return;
      }
      setBody("");
      await load();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Board</CardTitle>
        <CardDescription>
          Posts are stored by this app, scoped to this installation and channel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Label htmlFor="board-post">New post</Label>
          <Textarea
            id="board-post"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="Share something with the channel…"
            rows={3}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {body.length}/{MAX_LENGTH}
            </span>
            <Button type="submit" disabled={isPending || !body.trim()}>
              {isPending ? "Posting…" : "Post"}
            </Button>
          </div>
        </form>

        {loadError ? (
          <p role="alert" className="text-destructive text-sm">
            {loadError}
          </p>
        ) : posts === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No posts yet. Be the first.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{post.authorName}</span>
                  <time
                    dateTime={post.createdAt}
                    className="text-muted-foreground text-xs"
                  >
                    {new Date(post.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {post.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
