# Adding an app

Every folder in `apps/` is a separate Planeward app with its own Planeward credentials, database, port and deployment (see [How it works](how-it-works.md#one-app-one-of-everything)). To add one, copy `apps/web` and give the copy its own values. The examples below add `apps/polls`.

## 1. Copy the app

```bash
rsync -a --exclude node_modules --exclude .next --exclude .turbo --exclude .env \
  --exclude .planeward apps/web/ apps/polls/
```

This copies `.env.example` but not your `.env` or the emulator state in `.planeward/`, so no credentials from the other app come along.

## 2. Give it its own values

These must be unique across apps:

| File             | Change                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| `package.json`   | `"name": "@repo/polls"`, and a free port in `dev` and `start` (`--port 3006`)   |
| `compose.yml`    | `name: planeward-app-polls`, and a free host port (`"5434:5432"`)               |
| `.env.example`   | The same host port in `DATABASE_URL` (`localhost:5434`)                         |
| `planeward.json` | `name`, `slug` (`polls`), the port in `dev.command` and `dev.url`, and `scopes` |

Unique package names also let Vercel skip building apps a commit didn't touch.

## 3. Run it in the emulator

```bash
pnpm install                              # links the new workspace package
cp apps/polls/.env.example apps/polls/.env
pnpm db:up                                # starts every app's Postgres
pnpm --filter @repo/polls db:migrate
pnpm --filter @repo/polls dev:emulator    # emulator on :4600, app on http://localhost:3006
```

The emulator reads the copy's own `planeward.json`, so it shows the new app with its own name, scopes and local credentials. Root `pnpm dev:emulator` runs `apps/web` only.

The emulator port defaults to 4600. To run two emulators at once, give the copy its own in `package.json` (`"dev:emulator": "planeward dev --port 4601"`) and pass the same port to `trigger`: `pnpm --filter @repo/polls exec planeward trigger app.installed --port 4601`.

`pnpm dev` runs all apps at once without the emulator, each on its own port.

## 4. Connect it to Planeward

Each app needs its own Planeward app. A viewer token issued to one app is rejected by the others.

Follow [Going live](going-live.md#test-in-your-own-workspace) with the new port: register `http://localhost:3006/experience` and `http://localhost:3006/dashboard`, put the credentials in `apps/polls/.env`, and run `pnpm --filter @repo/polls dev`. The setup page at `http://localhost:3006/` lists the URLs and scopes. The Webhook URL needs a public `https` URL; a tunnel for it points at port 3006 ([Webhooks](going-live.md#webhooks)).

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
