# Adding an app

Every folder in `apps/` is a separate Planeward app with its own Planeward credentials, database, port and deployment (see [How it works](how-it-works.md#one-app-one-of-everything)). To add one, copy `apps/web` and give the copy its own values. The examples below add `apps/polls`.

## 1. Copy the app

```bash
rsync -a --exclude node_modules --exclude .next --exclude .turbo --exclude .env \
  apps/web/ apps/polls/
```

This copies `.env.example` but not your `.env`, so no credentials from the other app come along.

## 2. Give it its own values

These must be unique across apps:

| File               | Change                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| `package.json`     | `"name": "@repo/polls"`, and a free port in `dev` and `start` (`--port 3006`) |
| `compose.yml`      | `name: planeward-app-polls`, and a free host port (`"5434:5432"`)             |
| `.env.example`     | The same host port in `DATABASE_URL` (`localhost:5434`)                       |
| `src/app/page.tsx` | The port in the setup page's tunnel instructions (`3006`)                     |

Unique package names also let Vercel skip building apps a commit didn't touch.

## 3. Run it

```bash
pnpm install                              # links the new workspace package
cp apps/polls/.env.example apps/polls/.env
pnpm db:up                                # starts every app's Postgres
pnpm --filter @repo/polls db:migrate
pnpm --filter @repo/polls dev             # http://localhost:3006
```

`pnpm dev` runs all apps at once, each on its own port.

## 4. Connect it to Planeward

Each app needs its own Planeward app. A viewer token issued to one app is rejected by the others.

1. Start a tunnel to the new port: `cloudflared tunnel --url http://localhost:3006` or `ngrok http 3006`.
2. Put the tunnel hostname in `ALLOWED_DEV_ORIGINS` in `apps/polls/.env`, and restart the dev server.
3. In **Settings › Apps › Developer**, create a new app with the tunnel's `/experience`, `/dashboard` and `/api/webhooks/planeward` URLs, and the scopes it needs. The setup page at the tunnel URL lists them.
4. Copy the app id, app secret and webhook secret into `apps/polls/.env`, then restart.
5. Install it and add it to your community as a channel, as in the [README](../README.md#register-in-planeward).

## 5. Make it yours

The copy starts with the Board example: the experience page, `/api/posts` and the `posts` table.

- Replace them with your feature. Keep `requireViewer` and claims-derived ids in every route.
- Keep the `installations` and `webhook_deliveries` tables, which `src/lib/planeward.ts` needs.
- Edit `src/db/schema.ts`, then run `pnpm --filter @repo/polls db:generate` and `db:migrate`.
- The copy inherits `drizzle/0000_init.sql`. If you haven't migrated or deployed the new app yet, you can delete its `drizzle/` folder and run `db:generate` for a clean first migration instead.
- Request only the scopes the app uses. The scopes are listed in [API access](https://docs.planeward.com/docs/apps/api#scopes).
- Fill in a copy of [`for-communities.md`](for-communities.md) for the communities that install it.

## 6. Deploy it

Create a new Vercel project for the app, with Root Directory `apps/polls`. Pair it with a production Planeward app of its own. See [Deploying to Vercel](deploying-to-vercel.md).

## Removing an app

1. Run `docker compose down -v` in its folder. This removes its local database.
2. Delete the folder, then run `pnpm install`.
3. Delete its Vercel project and its Planeward apps.
