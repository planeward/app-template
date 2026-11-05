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

Requires Node 24+, pnpm 11 and Docker (for Postgres). You don't need a Planeward account or a tunnel: the app runs inside `planeward dev`, a local emulator of the Planeward host, API and webhooks.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # only DATABASE_URL is needed for the emulator
pnpm db:up                               # Postgres on :5433 (apps/web/compose.yml)
pnpm db:migrate
pnpm dev:emulator                        # emulator on http://127.0.0.1:4600, app on http://localhost:3005
```

`pnpm dev:emulator` runs the [`planeward`](https://www.npmjs.com/package/planeward) CLI ([source](https://github.com/planeward/cli)), a dev dependency of `apps/web`. It reads [`apps/web/planeward.json`](apps/web/planeward.json) (paths, scopes, dev command), starts `next dev` with local `PLANEWARD_BASE_URL`, `PLANEWARD_APP_ID`, `PLANEWARD_APP_SECRET` and `PLANEWARD_WEBHOOK_SECRET` (these override `.env`), and opens the emulator in your browser.

### What to try

- Switch the viewer (any seeded member, as member or admin), switch between Experience and Dashboard, and toggle the theme.
- Post on the Board as a member, then as an admin use **Announce as the app** on the dashboard.
- In **Activity**, post, react, complete a lesson, RSVP or submit a form as a member. Each sends the matching signed webhook to `/api/webhooks/planeward`; a member's first message awards the "First post" badge.
- Follow every API call in **Requests**. A call without its scope gets a 403 with `missingScope`, naming the scope to add to `planeward.json` (restart `pnpm dev:emulator` after editing it).
- Follow every delivery in **Webhooks**, and **Redeliver** one.
- From another terminal, send a single webhook: `pnpm --filter @repo/web exec planeward trigger community.message.created` (add `--member <id>` for a specific member).
- Press `r` in the emulator terminal to reset the seeded data.

Emulator state, including the local signing key and secrets, lives in `apps/web/.planeward/` (gitignored). Open `http://localhost:3005/` for the setup page.

## Next: going live

When you want real members and data, register the app on hosted Planeward. It accepts `http://localhost` URLs for an app installed only in your own workspace, so you can keep running it on your machine with `pnpm dev`: [Going live on Planeward](docs/going-live.md). To deploy it: [Deploying to Vercel](docs/deploying-to-vercel.md).

## How it works

Planeward (or, locally, the emulator) loads your app in an iframe and hands it a short-lived **viewer token** over `postMessage`. Your UI sends the token with every request to your own API routes. Each route verifies it with `requireViewer` and scopes all data by the `installationId` and `channelId` in its claims. Server-side, the app calls the Planeward API with its app secret, and Planeward sends signed webhooks for installs, uninstalls and membership changes.

[How it works](docs/how-it-works.md) has the diagrams, the request flow step by step, what each app owns, and how env and storage are wired.

## Security notes

- **Never trust ids from request bodies.** Use `viewer.installationId` / `viewer.channelId`, not values the client sends.
- **Don't rely on cookies in the iframe.** Third-party cookies are blocked in most browsers. Authenticate each request with the viewer token.
- **Leave the app frameable.** Don't set `X-Frame-Options`, and leave `frame-ancestors` open: communities can run on custom domains.
- **Keep the app secret server-only.** `PLANEWARD_APP_SECRET` and `PLANEWARD_WEBHOOK_SECRET` must never reach client code.
- **Webhooks only process after signature verification.** Unsigned or tampered deliveries get a 401 and nothing is stored.

For production (one app ID per deployment, public https webhooks), see [Going live](docs/going-live.md#production-checklist).

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
| [Going live](docs/going-live.md)                   | Testing on hosted Planeward, webhooks, dev and production    |
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
| [Testing your app](https://docs.planeward.com/docs/apps/testing)         | Localhost URLs, Requests, Deliveries, test events       |
| [postMessage protocol](https://docs.planeward.com/docs/apps/protocol)    | The iframe handshake and origin rules                   |
| [Apps in your community](https://docs.planeward.com/docs/community/apps) | What community owners and members see                   |

The SDK is [`@planeward/sdk`](https://www.npmjs.com/package/@planeward/sdk) ([source](https://github.com/planeward/sdk)).

## Scripts

| Command                                | What it does                          |
| -------------------------------------- | ------------------------------------- |
| `pnpm dev:emulator`                    | Run the app in the local emulator     |
| `pnpm dev`                             | Run every app with its own `.env`     |
| `pnpm build`                           | Build the app                         |
| `pnpm typecheck` / `lint` / `test`     | Checks across the workspace           |
| `pnpm format:check` / `format:write`   | Prettier                              |
| `pnpm db:up`                           | Start each app's local Postgres       |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply Drizzle migrations |
