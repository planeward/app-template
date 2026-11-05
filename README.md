# Planeward App Template

A starter for building Planeward Community Apps: third-party Next.js apps that Planeward shows in an iframe inside a community. Your app appears as a **member channel** (`/experience`) and a **staff dashboard** (`/dashboard`), and gets:

- a verified viewer identity (short-lived signed token from the host),
- a typed API client for the Planeward API,
- signed webhooks (`app.installed`, `app.uninstalled`, and more).

## Layout

| Path                                                             | Package           | What it is                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                       | `@repo/web`       | Next.js app on port 3005: setup page, experience, dashboard, API routes, its Drizzle schema and migrations, local Postgres (`compose.yml`), `.env` and `vercel.json` |
| `packages/planeward`                                             | `@repo/planeward` | React provider/hooks and server helpers (`requireViewer`, `handlePlanewardWebhook`)                                                                                  |
| `packages/ui`                                                    | `@repo/ui`        | shadcn/ui components and the Tailwind v4 theme                                                                                                                       |
| `packages/typescript-config`, `eslint-config`, `prettier-config` | `@repo/*-config`  | Shared configs                                                                                                                                                       |

Each folder in `apps/` is one self-contained Planeward app with its own credentials, database and deployment. Copy `apps/web` to add more ([guide](docs/adding-an-app.md)). The iframe handshake, token verification, webhooks and API client come from [`@planeward/sdk`](https://github.com/planeward/sdk) on npm.

## Quickstart

Requires Node 24+, pnpm 11, Docker and a tunnel ([cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or [ngrok](https://ngrok.com/download)).

Planeward is hosted at `https://app.planeward.com`. It loads your app in an iframe and sends it webhooks. Webhooks need a public `https` URL, so during development expose your dev server through a tunnel. To try only the iframe in your own workspace, you can skip the tunnel and [register `http://localhost` URLs](#testing-in-your-own-workspace-without-a-tunnel).

1. Install and start the app:

   ```bash
   pnpm install
   cp apps/web/.env.example apps/web/.env
   pnpm db:up             # Postgres on :5433 (apps/web/compose.yml)
   pnpm db:migrate
   pnpm dev               # app on http://localhost:3005
   ```

2. In another terminal, start a tunnel to port 3005:

   ```bash
   cloudflared tunnel --url http://localhost:3005   # prints https://<random>.trycloudflare.com
   # or
   ngrok http 3005                                  # prints https://<random>.ngrok-free.app
   ```

3. Put the tunnel **hostname** (no `https://`, no path) in `apps/web/.env`, then restart `pnpm dev`:

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
   - Scopes:
     - **Community — read members** (`COMMUNITY_MEMBERS_READ`): the dashboard member list and `community.membership.*` webhooks.
     - **Community — post messages as the app** (`COMMUNITY_MESSAGES_WRITE`): "Announce as the app".
     - **Community — read public channels and messages** (`COMMUNITY_MESSAGES_READ`): `community.message.created` webhooks for the First post badge.
     - **Community — manage and award badges** (`COMMUNITY_BADGES_WRITE`): creating and awarding the First post badge.
2. Copy the app ID, app secret and webhook secret into `apps/web/.env` (`PLANEWARD_APP_ID`, `PLANEWARD_APP_SECRET`, `PLANEWARD_WEBHOOK_SECRET`). They are shown once; rotate them from the app's menu if lost. Restart `pnpm dev`.
3. Install it from the install link (or **Install into this workspace**). Installing needs a workspace with **Community** turned on (Business plan or higher).
4. In **Community › Apps**, add it as a channel. Members see it in the community sidebar; staff open the dashboard from **Community › Apps**.

Viewer tokens are verified against `https://app.planeward.com/api/auth/jwks` and API calls go to Planeward with your app secret. Both are outbound requests, so they work from your machine.

### Testing in your own workspace without a tunnel

An app installed only in its publisher's own workspace may use `http://localhost` URLs. Register `http://localhost:3005/experience` and `http://localhost:3005/dashboard`, install it into your own workspace, and Planeward loads it straight from your dev server. Planeward can't reach `localhost` to deliver webhooks, so the Webhook URL still needs a tunnel (or leave it empty and the badge example won't run).

Use one Planeward app per environment, e.g. "My App (dev)" pointing at your tunnel and "My App" pointing at production. A token issued for a different app fails with `PlanewardTokenAudienceError`.

### Tunnel tips

- Quick tunnels get a new URL every run, so you would edit the app's URLs (in its menu, **Edit**) and `ALLOWED_DEV_ORIGINS` each time. For a stable URL, use a named Cloudflare tunnel on your own domain or a reserved ngrok domain.
- Webhooks (`app.installed`, `app.uninstalled`, `community.membership.*`, `community.message.created`, …) are retried after 1 min, 10 min, 1 h and 6 h if your tunnel is down, so events sent while it was offline arrive later.
- Only run the tunnel while you need it, and never commit `.env`.

## Local emulator (optional)

`planeward dev` runs your app inside a local emulator of the Planeward host, API and webhooks at `http://127.0.0.1:4600`, so you can switch viewers, post as a member and receive signed webhooks without a Planeward account or tunnel. It reads [`apps/web/planeward.json`](apps/web/planeward.json) (paths, scopes, dev command) and starts `next dev` with local `PLANEWARD_*` credentials, which override your `.env`.

The [`planeward`](https://www.npmjs.com/package/planeward) CLI ([source](https://github.com/planeward/cli)) is a dev dependency of `apps/web`, so `pnpm install` sets it up:

```bash
pnpm db:up && pnpm db:migrate
pnpm dev:emulator
```

The emulator opens in your browser. From there you can:

- switch the viewer (any seeded member, member or admin) and toggle Experience and Dashboard;
- post, react, complete a lesson, RSVP or submit a form as a member, and see the webhooks your app receives;
- follow every API call in **Requests** (a missing scope shows which one to add to `planeward.json`) and every delivery in **Webhooks**, with Redeliver.

From another terminal, `pnpm --filter @repo/web exec planeward trigger community.message.created` sends a single webhook. Press `r` in the emulator terminal to reset the seeded data.

Emulator state, including the local signing key and secrets, lives in `apps/web/.planeward/` (gitignored). `pnpm dev` is unchanged and doesn't use the emulator; use it with your real `.env` to test against Planeward.

## Deploying

Each app deploys to [Vercel](https://vercel.com) as its own project with Root Directory `apps/<name>`. Its `vercel.json` installs the workspace, migrates the database on production deploys and runs `next build`. Pair each deployment with a production Planeward app of its own, pointing at `/experience`, `/dashboard` and `/api/webhooks/planeward` on the production domain. Step by step, plus other hosts: [Deploying to Vercel](docs/deploying-to-vercel.md).

Do not add `X-Frame-Options` or a restrictive `frame-ancestors`: communities can live on custom domains.

## How it works

Planeward loads your app in an iframe and hands it a short-lived **viewer token** over `postMessage`. Your UI sends the token with every request to your own API routes. Each route verifies it with `requireViewer` and scopes all data by the `installationId` and `channelId` in its claims. Server-side, the app calls the Planeward API with its app secret, and Planeward sends signed webhooks for installs, uninstalls and membership changes.

[How it works](docs/how-it-works.md) has the diagrams, the request flow step by step, what each app owns, and how env and storage are wired.

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
- The badge example awards a "First post" badge on each member's first message: the webhook route's `onEvent` narrows `community.message.created` from the SDK's typed webhook union, records the first post per installation and member in `first_posts`, then calls `community.badges.upsert` and `community.members.badges.award` ([`src/lib/first-post-badge.ts`](apps/web/src/lib/first-post-badge.ts)). Remove it with its table and scopes if you don't need it.
- Add tables in `apps/web/src/db/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
- Each app owns its database: `@repo/planeward/server` never touches it. `apps/web/src/lib/planeward.ts` passes a Drizzle store to `createPlanewardServer`, which returns `requireViewer` and `handlePlanewardWebhook`.
- To add another app, copy `apps/web` and give it its own package name, port, Compose `name` and Postgres port, and its own Planeward app: [Adding an app](docs/adding-an-app.md).
- Fill in [`docs/for-communities.md`](docs/for-communities.md) and share it with the communities that install your app. It covers installing, the permissions you request, your data handling and uninstalling, and links to Planeward's [Apps in your community](https://docs.planeward.com/docs/community/apps) guide.

## Documentation

In this repo:

| Guide                                              | What it covers                                               |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [How it works](docs/how-it-works.md)               | Architecture, request flow, per-app layout, env and storage  |
| [Adding an app](docs/adding-an-app.md)             | Copying `apps/web` into a new, separate Planeward app        |
| [Deploying to Vercel](docs/deploying-to-vercel.md) | One Vercel project per app, env vars, migrations, previews   |
| [For communities](docs/for-communities.md)         | A guide to fill in for the communities that install your app |

Planeward docs:

| Page                                                                     | What it covers                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| [Community apps](https://docs.planeward.com/docs/apps)                   | Where apps appear, private and official apps, lifecycle |
| [Quickstart](https://docs.planeward.com/docs/apps/quickstart)            | Building an app with or without this template           |
| [Identity token](https://docs.planeward.com/docs/apps/identity)          | Viewer token claims, expiry and verification            |
| [API access](https://docs.planeward.com/docs/apps/api)                   | App secret, scopes, members and messages endpoints      |
| [App webhooks](https://docs.planeward.com/docs/apps/webhooks)            | Envelope, signature, events and retries                 |
| [postMessage protocol](https://docs.planeward.com/docs/apps/protocol)    | The iframe handshake and origin rules                   |
| [Apps in your community](https://docs.planeward.com/docs/community/apps) | What community owners and members see                   |

The SDK is [`@planeward/sdk`](https://www.npmjs.com/package/@planeward/sdk) ([source](https://github.com/planeward/sdk)).

## Scripts

| Command                                | What it does                          |
| -------------------------------------- | ------------------------------------- |
| `pnpm dev`                             | Run everything in dev mode            |
| `pnpm dev:emulator`                    | Run the app in the local emulator     |
| `pnpm build`                           | Build the app                         |
| `pnpm typecheck` / `lint` / `test`     | Checks across the workspace           |
| `pnpm format:check` / `format:write`   | Prettier                              |
| `pnpm db:up`                           | Start each app's local Postgres       |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply Drizzle migrations |
