# Deploying to Vercel

Each app in `apps/` deploys as its own Vercel project with its Root Directory set to the app's folder. The app's `vercel.json` does the rest:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then pnpm db:migrate; fi && pnpm build"
}
```

Vercel runs these commands in the app folder:

- `pnpm install` installs the whole workspace, including `packages/*`.
- `pnpm db:migrate` applies the app's migrations, on production deploys only.
- `pnpm build` runs `next build`.

None of the commands names the app, so a copied app deploys without changes.

The examples below use `apps/web`. For another app, use its folder.

## 1. Create the production Planeward app

Use a separate Planeward app for production, not the one pointing at your tunnel. A token issued for one app is rejected by the other.

1. In **Settings › Apps › Developer**, create an app with your production domain: a custom domain, or `https://<project-name>.vercel.app`. If the domain changes later, edit the URLs from the app's menu (**Edit**).
   - Experience URL: `https://<domain>/experience`
   - Dashboard URL: `https://<domain>/dashboard`
   - Webhook URL: `https://<domain>/api/webhooks/planeward`
   - The scopes the app uses
2. Copy the app id, app secret and webhook secret. They are shown once.

## 2. Create a database

Use any Postgres that Vercel can reach. In Vercel, **Storage** offers Postgres providers from the Marketplace. Neon's integration sets `DATABASE_URL` (pooled) on the projects you connect it to, and can create a database branch for each preview deployment.

## 3. Import the repo

1. In Vercel, select **Add New › Project** and import the repository.
2. Set **Root Directory** to `apps/web`. Vercel detects Next.js, and `apps/web/vercel.json` sets the install and build commands. Leave **Include files outside the root directory** on: the app builds `packages/*` from source.
3. Add the environment variables:

   | Variable                   | Value                                             |
   | -------------------------- | ------------------------------------------------- |
   | `PLANEWARD_APP_ID`         | From step 1                                       |
   | `PLANEWARD_APP_SECRET`     | From step 1                                       |
   | `PLANEWARD_WEBHOOK_SECRET` | From step 1                                       |
   | `DATABASE_URL`             | From step 2 (set for you if you connected Neon)   |
   | `PLANEWARD_BASE_URL`       | Optional, defaults to `https://app.planeward.com` |

   Leave `ALLOWED_DEV_ORIGINS` unset; it's for local tunnels only. `next build` checks the required variables, so a deploy without them fails.

4. Deploy. The production build migrates the database first.

## 4. Check and install

1. Open `https://<domain>/`. The setup page shows which variables are set and the URLs to register. Check that they match the Planeward app.
2. Install the app from its install link, then add it to your community as a channel (see [Apps in your community](https://docs.planeward.com/docs/community/apps)).

## Deploys after that

| Deploy     | Runs                                              |
| ---------- | ------------------------------------------------- |
| Production | `pnpm install` → `pnpm db:migrate` → `pnpm build` |
| Preview    | `pnpm install` → `pnpm build` (no migration)      |

Previews connect to whatever `DATABASE_URL` is set for the Preview environment. To migrate preview databases too (for example a Neon branch per preview), remove the `VERCEL_ENV` check from `vercel.json`.

Changes to environment variables only apply to new deployments. After rotating a secret in Planeward, update it in Vercel and redeploy.

## Notes

- **Previews are behind a login.** Vercel's Standard Protection, the recommended setting, requires a Vercel login on every URL except production domains. Planeward can't load a protected URL in its iframe or deliver webhooks to it, so register the production domain. To try a change inside Planeward before production, run it locally through a tunnel.
- **Keep the app frameable.** Vercel doesn't add `X-Frame-Options`. Don't add it, or a restrictive `frame-ancestors`, yourself: communities can run on custom domains.
- **One project per app.** Each app folder gets its own Vercel project, Root Directory and environment variables. When the repo is connected to GitHub, Vercel skips building apps a commit didn't change, as long as every workspace package has a unique `name`.
- **Region.** Run functions in the same region as the database (**Settings › Functions**).
- **Node.js.** The template needs Node 24 or newer (**Settings › Build and Deployment › Node.js Version**).

## Other hosts

The app is a standard Next.js app. To deploy it anywhere else:

1. Set the same environment variables.
2. In the app folder, run `pnpm install --frozen-lockfile`, `pnpm db:migrate` and `pnpm build`.
3. Serve it with `pnpm start` over public `https`.

See Vercel's [monorepo](https://vercel.com/docs/monorepos), [environment variables](https://vercel.com/docs/environment-variables) and [Deployment Protection](https://vercel.com/docs/deployment-protection) docs for details.
