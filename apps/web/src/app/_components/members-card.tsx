"use client";

import type { CommunityAppMember, ListResponse } from "@planeward/sdk/server";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { useViewerJson } from "@/lib/use-viewer-json";

export function MembersCard() {
  const result =
    useViewerJson<ListResponse<CommunityAppMember>>("/api/members");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {result.status === "ok"
            ? `${result.data.data.length} of ${result.data.meta.total}, from the Planeward API.`
            : "From the Planeward API (COMMUNITY_MEMBERS_READ)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result.status === "loading" ? (
          <Skeleton className="h-32 w-full" />
        ) : result.status === "error" ? (
          <p role="alert" className="text-destructive text-sm">
            {result.error}
          </p>
        ) : result.data.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.data.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.displayName}</span>
                      {member.username ? (
                        <span className="text-muted-foreground text-xs">
                          @{member.username}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.status === "ACTIVE" ? "secondary" : "outline"
                      }
                    >
                      {member.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
