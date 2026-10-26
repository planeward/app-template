"use client";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import type { InstallationJson } from "@/lib/types";

export function InstallationCard({
  installation,
}: {
  installation: InstallationJson | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Installation</CardTitle>
        <CardDescription>
          Stored from the <code>app.installed</code> webhook.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {installation ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Workspace</dt>
            <dd>{installation.workspaceName}</dd>
            <dt className="text-muted-foreground">Installation id</dt>
            <dd className="truncate font-mono">{installation.id}</dd>
            <dt className="text-muted-foreground">Installed</dt>
            <dd>{new Date(installation.installedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              {installation.uninstalledAt ? (
                <Badge variant="destructive">
                  Uninstalled{" "}
                  {new Date(installation.uninstalledAt).toLocaleDateString()}
                </Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </dd>
            <dt className="text-muted-foreground">Scopes</dt>
            <dd className="flex flex-wrap gap-1">
              {installation.grantedPermissions.length > 0
                ? installation.grantedPermissions.map((permission) => (
                    <Badge key={permission} variant="outline">
                      {permission}
                    </Badge>
                  ))
                : "None"}
            </dd>
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            No record yet. Check that the webhook URL is registered, then
            reinstall the app or resend <code>app.installed</code>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
