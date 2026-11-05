import type { Metadata } from "next";
import { headers } from "next/headers";

import { Badge } from "@repo/ui/components/badge";
import { buttonVariants } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { emulatorUrl, envStatus } from "@/lib/env-status";

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
  {
    name: "COMMUNITY_MESSAGES_READ",
    use: "community.message.created webhooks for the First post badge",
  },
  {
    name: "COMMUNITY_BADGES_WRITE",
    use: "Create and award the First post badge",
  },
];

function isLoopback(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
}

async function appHost(): Promise<{ origin: string; isLocal: boolean }> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const isLocal = isLoopback(host);
  const proto =
    headerList.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return { origin: `${proto}://${host}`, isLocal };
}

export default async function SetupPage() {
  const { origin, isLocal } = await appHost();
  const emulator = emulatorUrl();
  const env = envStatus();
  const missing = env.filter((entry) => !entry.set).length;

  const frameUrls = [
    { label: "Experience URL", value: `${origin}/experience` },
    { label: "Dashboard URL", value: `${origin}/dashboard` },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">Planeward Community App</p>
        <h1 className="text-3xl font-semibold tracking-tight">Setup</h1>
        <p className="text-muted-foreground">
          This app runs inside a Planeward community as an iframe. Build it in
          the local emulator, then register it in Planeward when you’re ready
          for real data.
        </p>
      </header>

      {emulator ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Running in the local emulator</CardTitle>
              <Badge variant="secondary">Emulator</Badge>
            </div>
            <CardDescription>
              <code>pnpm dev:emulator</code> started this app with local{" "}
              <code>PLANEWARD_*</code> credentials. Open the app from the
              emulator, which frames it, mints viewer tokens, serves the API and
              sends webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={emulator} className={buttonVariants()}>
              Open the emulator
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Run it in the local emulator</CardTitle>
            <CardDescription>
              A local Planeward host, API and webhooks. No account or tunnel
              needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              <li>
                Start Postgres with <code>pnpm db:up</code> and run{" "}
                <code>pnpm db:migrate</code>.
              </li>
              <li>
                Stop this server and run <code>pnpm dev:emulator</code> from the
                repo root. It starts the app with local <code>PLANEWARD_*</code>{" "}
                credentials and opens the emulator.
              </li>
              <li>
                Switch viewers, post as a member, and follow the Requests and
                Webhooks panels.
              </li>
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>
            {emulator
              ? "The emulator sets the PLANEWARD_* variables, overriding .env; DATABASE_URL comes from .env."
              : "Read from this app’s .env locally, or your host’s environment variables when deployed. The emulator needs only DATABASE_URL."}{" "}
            Values are never shown.
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
          <CardTitle>Register in Planeward</CardTitle>
          <CardDescription>
            In Planeward: Settings › Apps › Developer. Built from this request’s
            host.{" "}
            {isLocal ? (
              <>
                Localhost URLs work while the app is installed only in your own
                workspace; run it there with <code>pnpm dev</code>.
              </>
            ) : (
              "Use your public HTTPS domain in production."
            )}{" "}
            Steps, browsers and webhooks: <code>docs/going-live.md</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {frameUrls.map((url) => (
            <CopyField key={url.label} label={url.label} value={url.value} />
          ))}
          {isLocal ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <p className="font-medium">Webhook URL</p>
              <p className="text-muted-foreground">
                Planeward can’t reach <code>localhost</code>, so webhooks need a
                public HTTPS URL. Leave it empty and test webhooks in the
                emulator, or start a tunnel (
                <code>cloudflared tunnel --url {origin}</code>) and register{" "}
                <code>https://&lt;tunnel-host&gt;/api/webhooks/planeward</code>.
              </p>
            </div>
          ) : (
            <CopyField
              label="Webhook URL"
              value={`${origin}/api/webhooks/planeward`}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scopes to request</CardTitle>
          <CardDescription>
            The same scopes as <code>planeward.json</code>, which the emulator
            grants.
          </CardDescription>
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
    </main>
  );
}
