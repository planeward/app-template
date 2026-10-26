# Planeward App Template

A starter for building Planeward Community Apps: third-party Next.js apps that Planeward shows in an iframe inside a community. Your app appears as a **member channel** (`/experience`) and a **staff dashboard** (`/dashboard`), and gets:

- a verified viewer identity (short-lived signed token from the host),
- a typed API client for the Planeward API,
- signed webhooks (`app.installed`, `app.uninstalled`, and more).

## Layout

| Path                                                             | Package           | What it is                                                                                                 |
| ---------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                       | `@repo/web`       | Next.js app on port 3005: setup page, experience, dashboard, API routes, its Drizzle schema and migrations |
| `packages/planeward`                                             | `@repo/planeward` | React provider/hooks and server helpers (`requireViewer`, `handlePlanewardWebhook`)                        |
| `packages/ui`                                                    | `@repo/ui`        | shadcn/ui components and the Tailwind v4 theme                                                             |
| `packages/typescript-config`, `eslint-config`, `prettier-config` | `@repo/*-config`  | Shared configs                                                                                             |

The iframe handshake, token verification, webhooks and API client come from [`@planeward/sdk`](https://github.com/planeward/sdk) on npm.

## Quickstart

Requires Node 24+, pnpm 11, Docker and a tunnel ([cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or [ngrok](https://ngrok.com/download)).

Planeward is hosted at `https://app.planeward.com`. It loads your app in an iframe and sends it webhooks, so it must reach your app over public `https`; `localhost` URLs are rejected. During development, expose your dev server through a tunnel.

1. Install and start the app:

   ```bash
   pnpm install
   cp .env.example .env
   docker compose up -d   # Postgres on :5433
   pnpm db:migrate
   pnpm dev               # app on http://localhost:3005
   ```

2. In another terminal, start a tunnel to port 3005:

   ```bash
   cloudflared tunnel --url http://localhost:3005   # prints https://<random>.trycloudflare.com
   # or
   ngrok http 3005                                  # prints https://<random>.ngrok-free.app
   ```

3. Put the tunnel **hostname** (no `https://`, no path) in `.env`, then restart `pnpm dev`:

   ```bash
   ALLOWED_DEV_ORIGINS="abc-123.trycloudflare.com"
   ```

   Next.js only serves dev assets to `localhost` and the hosts listed here. Without it the app loads inside Planeward but never connects.

4. Open the setup page through the tunnel (`https://abc-123.trycloudflare.com/`). It shows which env vars are set and the exact URLs to register.

## Register in Planeward

1. In **Settings › Apps › Developer**, create an app with your tunnel origin:
   - Experience URL: `https://abc-123.trycloudflare.com/experience`
   - Dashboard URL: `https://abc-123.trycloudflare.com/dashboard`
   - Webhook URL: `https://abc-123.trycloudflare.com/api/webhooks/planeward`
   - Both scopes: **Community — read members** (`COMMUNITY_MEMBERS_READ`) and **Community — post messages as the app** (`COMMUNITY_MESSAGES_WRITE`).
2. Copy the app ID, app secret and webhook secret into `.env` (`PLANEWARD_APP_ID`, `PLANEWARD_APP_SECRET`, `PLANEWARD_WEBHOOK_SECRET`). They are shown once; rotate them from the app's menu if lost. Restart `pnpm dev`.
3. Install it from the install link (or **Install into this workspace**). Installing needs a workspace with **Community** turned on (Business plan or higher).
4. In **Community › Apps**, add it as a channel. Members see it in the community sidebar; staff open the dashboard from **Community › Apps**.

Viewer tokens are verified against `https://app.planeward.com/api/auth/jwks` and API calls go to Planeward with your app secret. Both are outbound requests, so they work from your machine.

Use one Planeward app per environment, e.g. "My App (dev)" pointing at your tunnel and "My App" pointing at production. A token issued for a different app fails with `PlanewardTokenAudienceError`.

### Tunnel tips

- Quick tunnels get a new URL every run, so you would edit the app's URLs (in its menu, **Edit**) and `ALLOWED_DEV_ORIGINS` each time. For a stable URL, use a named Cloudflare tunnel on your own domain or a reserved ngrok domain.
- Webhooks (`app.installed`, `app.uninstalled`, `community.membership.*`) are retried after 1 min, 10 min, 1 h and 6 h if your tunnel is down, so events sent while it was offline arrive later.
- Only run the tunnel while you need it, and never commit `.env`.

## Deploying

Deploy `apps/web` anywhere that runs Next.js with a public `https` URL, with a Postgres database:

1. Set `PLANEWARD_APP_ID`, `PLANEWARD_APP_SECRET`, `PLANEWARD_WEBHOOK_SECRET` and `DATABASE_URL` for your production Planeward app. Leave `ALLOWED_DEV_ORIGINS` unset; `PLANEWARD_BASE_URL` defaults to `https://app.planeward.com`.
2. Run `pnpm db:migrate` against the production database.
3. Point the production Planeward app at the deployed URLs (`/experience`, `/dashboard`, `/api/webhooks/planeward`).
4. Do not add `X-Frame-Options` or a restrictive `frame-ancestors`: communities can live on custom domains.

## How it works

### Where things run

```mermaid
flowchart LR
  subgraph browser["Member's browser"]
    host["Planeward community page<br/>(host)"]
    frame["Your app UI<br/>(iframe)"]
  end

  subgraph yours["Your app (apps/web)"]
    server["API routes + webhook route<br/>requireViewer() · handlePlanewardWebhook()"]
    db[("Postgres<br/>src/db")]
  end

  pw["Planeward<br/>app.planeward.com<br/>JWKS · Community API · webhooks"]

  host <-->|"postMessage<br/>viewer token + theme"| frame
  frame -->|"Bearer viewer token"| server
  server --> db
  server -->|"verify token (JWKS)<br/>API calls (app secret)"| pw
  pw -->|"signed webhooks"| server
```

In development, Planeward reaches your machine through the tunnel: `https://<tunnel>` forwards to `http://localhost:3005`, which serves both the iframe pages and the API routes.

### One request, step by step

```mermaid
sequenceDiagram
  autonumber
  actor Member
  participant Host as Planeward page (host)
  participant App as Your app UI (iframe)
  participant Server as Your API routes
  participant PW as Planeward API + JWKS
  participant DB as Your Postgres

  Member->>Host: Open the app channel
  Host->>App: Load experience URL in an iframe
  App->>Host: postMessage planeward:app:ready
  Host->>PW: Mint viewer token (checks member can view the channel)
  PW-->>Host: JWT, 5 min, aud = your app ID
  Host->>App: postMessage planeward:app:token (token, view, channelId, theme)
  App->>Server: GET /api/posts (Authorization: Bearer token)
  Server->>PW: Verify signature with JWKS (cached)
  Server->>Server: Check aud, expiry, installation not uninstalled
  Server->>DB: Read posts WHERE installationId, channelId (from the token)
  DB-->>Server: Rows
  Server-->>App: JSON
  opt Admin action, e.g. Announce as the app
    Server->>PW: POST /api/v1/community/channels/{id}/messages (app secret)
  end
  Note over PW,Server: Separately, Planeward POSTs signed webhooks<br/>(app.installed, app.uninstalled, community.membership.*)<br/>to /api/webhooks/planeward, which verifies, dedupes and stores them.
```

### In short

1. **Handshake.** The page loads in the iframe and `PlanewardProvider` performs a `postMessage` handshake with the host. The host returns the context, theme and a short-lived **viewer token** (a JWT signed by Planeward with `aud` = your app ID).
2. **Viewer token.** `useViewerFetch()` sends that token as `Authorization: Bearer <token>` on every call to your own API.
3. **`requireViewer`.** Every API route starts with `requireViewer(request)` from `@/lib/planeward`, which verifies the token against `PLANEWARD_BASE_URL` and `PLANEWARD_APP_ID` and returns the claims (or a 401/403 response).
4. **Scoping.** `installationId` and `channelId` come **only** from the verified claims. All data (for example the Board `posts`) is read and written by those ids, so one community can never see another's data. `planewardForViewer(viewer)` builds the API client for the claims' installation.
5. **Webhooks.** `/api/webhooks/planeward` uses `handlePlanewardWebhook`: it verifies the signature on the raw body, dedupes on `x-planeward-delivery` (stored in `webhook_deliveries`), records installs and uninstalls in `installations`, then calls your handler.

## Security notes

- **One app ID per deployment.** Tokens are checked against `PLANEWARD_APP_ID` (`aud`). A token for another app fails with `PlanewardTokenAudienceError`: `Token is for app "<aud>", but this backend expects "<appId>". Check PLANEWARD_APP_ID.`
- **Never trust ids from request bodies.** Use `viewer.installationId` / `viewer.channelId`, not values the client sends.
- **Don't rely on cookies in the iframe.** Third-party cookies are blocked in most browsers. Authenticate each request with the viewer token.
- **Leave the app frameable.** Don't set `X-Frame-Options`, and leave `frame-ancestors` open: communities can run on custom domains.
- **Keep the app secret server-only.** `PLANEWARD_APP_SECRET` and `PLANEWARD_WEBHOOK_SECRET` must never reach client code.
- **Webhooks only process after signature verification.** Unsigned or tampered deliveries get a 401 and nothing is stored.
- **Production webhook URLs must be public https.** `localhost` works only for development.

## Customizing

- Replace the Board example (`apps/web` experience, `/api/posts`, and the `posts` table) with your feature. Keep `requireViewer` and claims-derived ids in every route.
- Add tables in `apps/web/src/db/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
- Each app owns its database: `@repo/planeward/server` never touches it. `apps/web/src/lib/planeward.ts` passes a Drizzle store to `createPlanewardServer`, which returns `requireViewer` and `handlePlanewardWebhook`. To add a second app, copy `apps/web` (with its `src/db`, `drizzle/` and `src/lib/planeward.ts`) and give it its own `DATABASE_URL`.
- Fill in [`docs/for-communities.md`](docs/for-communities.md) and share it with the communities that install your app. It covers installing, the permissions you request, your data handling and uninstalling, and links to Planeward's [Apps in your community](https://docs.planeward.com/docs/community/apps) guide.

## Scripts

| Command                                | What it does                          |
| -------------------------------------- | ------------------------------------- |
| `pnpm dev`                             | Run everything in dev mode            |
| `pnpm build`                           | Build the app                         |
| `pnpm typecheck` / `lint` / `test`     | Checks across the workspace           |
| `pnpm format:check` / `format:write`   | Prettier                              |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply Drizzle migrations |
