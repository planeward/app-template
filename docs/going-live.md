# Going live on Planeward

The [emulator](../README.md#quickstart) covers most of development. When you want real members and data, register the app on hosted Planeward (`https://app.planeward.com`). You do that twice:

| Planeward app             | URLs                                          | Installed in                        |
| ------------------------- | --------------------------------------------- | ----------------------------------- |
| Dev, e.g. "My App (dev)"  | `http://localhost:3005/...` on your machine   | Only your own workspace             |
| Production, e.g. "My App" | Your deployed domain (`https://<domain>/...`) | Any workspace with the install link |

Use a separate Planeward app for each environment. Viewer tokens are checked against `PLANEWARD_APP_ID` (`aud`), so a token issued for one app fails on the other with `PlanewardTokenAudienceError`.

Planeward's own guide to this is [Testing your app](https://docs.planeward.com/docs/apps/testing).

## Test in your own workspace

Hosted Planeward accepts `http://localhost` (also `127.0.0.1` and `[::1]`) Experience and Dashboard URLs for an app installed only in its publisher's own workspace. The member's browser loads the iframe from your dev server, and viewer token verification and API calls are outbound requests from your machine, so all of that works without a tunnel. Only webhooks need a public URL ([below](#webhooks)).

1. In **Settings › Apps › Developer**, create an app:
   - Experience URL: `http://localhost:3005/experience`
   - Dashboard URL: `http://localhost:3005/dashboard`
   - Webhook URL: leave it empty for now, or see [Webhooks](#webhooks).
   - Scopes (the same as `apps/web/planeward.json`):
     - **Community — read members** (`COMMUNITY_MEMBERS_READ`): the dashboard member list and `community.membership.*` webhooks.
     - **Community — post messages as the app** (`COMMUNITY_MESSAGES_WRITE`): "Announce as the app".
     - **Community — read public channels and messages** (`COMMUNITY_MESSAGES_READ`): `community.message.created` webhooks for the First post badge.
     - **Community — manage and award badges** (`COMMUNITY_BADGES_WRITE`): creating and awarding the First post badge.
2. Copy the app ID, app secret and webhook secret into `apps/web/.env` (`PLANEWARD_APP_ID`, `PLANEWARD_APP_SECRET`, `PLANEWARD_WEBHOOK_SECRET`). They are shown once; rotate them from the app's menu if lost.
3. Install it with **Install into this workspace**. Installing needs a workspace with **Community** turned on (Business plan or higher).
4. In **Community › Apps**, add it as a channel. Members see it in the community sidebar; staff open the dashboard from **Community › Apps**.
5. Run `pnpm dev` (not `pnpm dev:emulator`, whose local credentials override `.env`) and open the channel.

The setup page at `http://localhost:3005/` shows which variables are set and the URLs to register.

While its URLs are on localhost, the app shows a **Local dev** badge and stays in your workspace: its install link is refused in other workspaces, and official apps can't use localhost URLs.

### Browsers

- **Chrome** may ask to allow the community site to access devices on your local network. Allow it, or the frame stays blank.
- **Safari** blocks `http://localhost` inside an `https` page. Serve the app over HTTPS with `pnpm --filter @repo/web exec next dev --port 3005 --experimental-https`, and register `https://localhost:3005/experience` and `https://localhost:3005/dashboard`.

## Webhooks

Planeward can't reach `localhost`, so the Webhook URL must be public `https`, even for a local dev app. Without one, Planeward sends no webhooks (`app.installed`, `community.message.created`, …) and the badge example doesn't run. Either:

- **Keep using the emulator for webhook work.** It sends the same signed events, and `pnpm --filter @repo/web exec planeward trigger <event>` sends one on demand.
- **Run a tunnel for the webhook URL only.** The Experience and Dashboard URLs stay on localhost.

  ```bash
  cloudflared tunnel --url http://localhost:3005   # prints https://<random>.trycloudflare.com
  # or
  ngrok http 3005                                  # prints https://<random>.ngrok-free.app
  ```

  Set the Webhook URL to `https://<tunnel-host>/api/webhooks/planeward` (from the app's menu, **Edit**). No `ALLOWED_DEV_ORIGINS` is needed: webhooks are server-to-server POSTs to an API route, and Next.js only restricts its own dev resources (`/_next/*`).

Tunnel tips:

- Quick tunnels get a new URL every run, so you would edit the Webhook URL each time. For a stable URL, use a named Cloudflare tunnel on your own domain or a reserved ngrok domain.
- Deliveries are retried after 1 min, 10 min, 1 h and 6 h, so events sent while the tunnel was down arrive later.
- **Send test event**, **Deliveries** and **Requests** in the app's menu show what Planeward sent and what your app called.
- Only run the tunnel while you need it, and never commit `.env`.

### Loading the app UI through a tunnel

If you register the tunnel's `https` URLs for the Experience and Dashboard too, put the tunnel **hostname** (no `https://`, no path) in `apps/web/.env` and restart `pnpm dev`:

```bash
ALLOWED_DEV_ORIGINS="abc-123.trycloudflare.com"
```

Next.js serves its dev resources only to `localhost` and the hosts listed there. Without it, the app loads inside Planeward but never connects.

## Production

Deploy the app, then create a second Planeward app pointing at the deployed domain:

- Experience URL: `https://<domain>/experience`
- Dashboard URL: `https://<domain>/dashboard`
- Webhook URL: `https://<domain>/api/webhooks/planeward`
- The scopes the app uses

[Deploying to Vercel](deploying-to-vercel.md) walks through both, plus other hosts. Once it's installed, share [`for-communities.md`](for-communities.md), filled in, with the communities that install it.

### Production checklist

- **One app ID per deployment.** A token for another app fails with `PlanewardTokenAudienceError`: `Token is for app "<aud>", but this backend expects "<appId>". Check PLANEWARD_APP_ID.`
- **Every URL is public `https`.** Localhost URLs keep an app in your own workspace, and webhook URLs must be public `https`.
- **Leave `ALLOWED_DEV_ORIGINS` unset.** It only affects `next dev`.
- **Secrets live in the host's environment**, not in the repo. After rotating one in Planeward, update it there and redeploy.
