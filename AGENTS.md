# AGENTS.md

Conventions for AI agents working in this repo (a Planeward Community App template).

## Layout

- `apps/web`: the Next.js 16 app (port 3005). It owns its database: Drizzle schema, client and env in `src/db`, migrations in `drizzle/`, local Postgres in `compose.yml`. Its env lives in `apps/web/.env` (Next.js loads it; there is no root `.env`), and `vercel.json` deploys it as its own Vercel project.
- Each folder in `apps/` is a separate Planeward app; nothing app-specific belongs at the repo root. Adding one: `docs/adding-an-app.md`.
- `packages/planeward`: `@repo/planeward` (`/client`, `/server`, `/env`).
- `packages/ui`: `@repo/ui` (shadcn/ui + Tailwind v4).
- `packages/{typescript,eslint,prettier}-config`: shared configs.

Internal packages are named `@repo/*` and are JIT TypeScript: they export `src/*.ts` directly and are listed in the app's `transpilePackages`. None has a build step; turbo `typecheck`, `lint` and `test` depend on `^build` as a transit node, so cached runs still see changes in internal dependencies. Workspace deps use `workspace:*`; shared versions live in the `catalog:` in `pnpm-workspace.yaml`. The public SDK, `@planeward/sdk`, comes from npm; its source is https://github.com/planeward/sdk.

Docs: `docs/how-it-works.md` (architecture), `docs/adding-an-app.md`, `docs/deploying-to-vercel.md`. Platform behavior (token claims, scopes, endpoints, webhook events) is documented at https://docs.planeward.com/docs/apps; check it before assuming an API.

## Commands

```bash
pnpm dev                 # all dev servers
pnpm build               # build everything
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check        # or format:write
pnpm db:up               # start each app's Postgres (docker compose)
pnpm db:generate         # after schema changes
pnpm db:migrate
pnpm --filter <pkg> <script>
```

After editing files, run Prettier on the changed paths: `pnpm exec prettier --write <paths>`.

## Rules

- **Every API route calls `requireViewer(request)`** from `@/lib/planeward` first (`{ role: "admin" }` for staff-only routes). Return its `response` when `ok` is false.
- **Scope data by claims only.** `installationId`, `channelId` and the author (`sub`) come from the verified viewer, never from the request body, query or headers. The one deliberate exception is an admin choosing a _target_ channel (`/api/announce`): the installation still comes from the claims, and Planeward enforces which channels the app may post to.
- Use `planewardForViewer(viewer)` (also from `@/lib/planeward`) for Planeward API calls; never build a client from a client-supplied installation id.
- Webhooks go through `handlePlanewardWebhook`; do not process a payload before signature verification.
- Secrets (`PLANEWARD_APP_SECRET`, `PLANEWARD_WEBHOOK_SECRET`) are server-only. Read env through `@repo/planeward/env` (and `DATABASE_URL` through `@/db/env`), not `process.env` in app code (exception: `apps/web/src/lib/env-status.ts`, which only reports set/unset for the setup page).
- Do not add `X-Frame-Options` or rely on cookies: the app runs in a cross-origin iframe.
- **Each app owns its database.** `@repo/planeward` must not import a database; it gets storage through `createPlanewardServer(store)`, which each app calls in `src/lib/planeward.ts`.
- **Schema changes:** edit `apps/web/src/db/schema.ts`, then `pnpm db:generate` to create a migration. Never hand-edit generated migrations.

## Next.js

This is a recent Next.js version whose APIs may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code.

## Turborepo

Turbo config and CLI behavior vary by version. Read `docs/README.md` in the installed `turbo` package (`node -p "require.resolve('turbo/package.json')"`) and the relevant pages before changing `turbo.json`.
