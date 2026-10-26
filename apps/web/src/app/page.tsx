import type { Metadata } from "next";
import { headers } from "next/headers";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { envStatus } from "@/lib/env-status";

import { CopyField } from "./_components/copy-field";

export const metadata: Metadata = { title: "Setup" };

const SCOPES = [
  {
    name: "COMMUNITY_MEMBERS_READ",
    use: "Dashboard member list and community.membership.* webhooks",
  },
  {
    name: "COMMUNITY_MESSAGES_WRITE",
    use: "“Announce as the app” on the member view",
  },
];

async function appOrigin(): Promise<string> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

export default async function SetupPage() {
  const origin = await appOrigin();
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);
  const env = envStatus();
  const missing = env.filter((entry) => !entry.set).length;

  const urls = [
    { label: "Experience URL", value: `${origin}/experience` },
    { label: "Dashboard URL", value: `${origin}/dashboard` },
    { label: "Webhook URL", value: `${origin}/api/webhooks/planeward` },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">Planeward Community App</p>
        <h1 className="text-3xl font-semibold tracking-tight">Setup</h1>
        <p className="text-muted-foreground">
          This app runs inside a Planeward community as an iframe. Register the
          URLs below, install the app, then add it to your community as a
          channel.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>
            Read from the repo root <code>.env</code>. Values are never shown.
            {missing > 0
              ? ` ${missing} missing: copy .env.example to .env and fill it in.`
              : " Everything is set."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {env.map((entry) => (
              <li
                key={entry.name}
                className="flex items-center justify-between gap-4 py-2"
              >
                <code className="text-sm">{entry.name}</code>
                <Badge variant={entry.set ? "secondary" : "destructive"}>
                  {entry.set ? "Set" : "Unset"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>URLs to register</CardTitle>
          <CardDescription>
            In Planeward: Settings › Apps › Developer. Built from this request’s
            host; use your public HTTPS domain in production.
          </CardDescription>
        </CardHeader>
        {isLocal ? (
          <CardContent>
            <p className="bg-muted rounded-md px-3 py-2 text-sm">
              Planeward can’t reach <code>localhost</code>. Start a tunnel to
              port 3005 (
              <code>cloudflared tunnel --url http://localhost:3005</code>
              ), add its hostname to <code>ALLOWED_DEV_ORIGINS</code>, and open
              this page through the tunnel URL to get the URLs to register.
            </p>
          </CardContent>
        ) : null}
        <CardContent className="flex flex-col gap-4">
          {urls.map((url) => (
            <CopyField key={url.label} label={url.label} value={url.value} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scopes to request</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {SCOPES.map((scope) => (
              <li key={scope.name} className="flex flex-col gap-0.5">
                <code className="text-sm font-medium">{scope.name}</code>
                <span className="text-muted-foreground text-sm">
                  {scope.use}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>
              Start Postgres with <code>docker compose up -d</code> and run{" "}
              <code>pnpm db:migrate</code>.
            </li>
            <li>
              Start a tunnel to port 3005, put its hostname in{" "}
              <code>ALLOWED_DEV_ORIGINS</code> in <code>.env</code>, restart{" "}
              <code>pnpm dev</code>, and open this page through the tunnel.
            </li>
            <li>
              Create the app in Planeward under Settings › Apps › Developer with
              the URLs and scopes above.
            </li>
            <li>
              Copy the app id, app secret and webhook secret into{" "}
              <code>.env</code>, then restart <code>pnpm dev</code>.
            </li>
            <li>
              Install the app in your workspace. The <code>app.installed</code>{" "}
              webhook stores the installation.
            </li>
            <li>
              Add the app to your community as a channel and open it. Staff can
              open the dashboard under Community › Apps.
            </li>
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
