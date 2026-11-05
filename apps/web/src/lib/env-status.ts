/** Env vars the app needs. The setup page shows set/unset only, never values. */
export const REQUIRED_ENV = [
  "PLANEWARD_APP_ID",
  "PLANEWARD_APP_SECRET",
  "PLANEWARD_WEBHOOK_SECRET",
  "PLANEWARD_BASE_URL",
  "DATABASE_URL",
] as const;

export type EnvStatus = { name: (typeof REQUIRED_ENV)[number]; set: boolean };

/** Reads `process.env` on purpose: reports set/unset without validating, so the setup page renders before `.env` is complete. */
export function envStatus(): EnvStatus[] {
  return REQUIRED_ENV.map((name) => ({
    name,
    set: Boolean(process.env[name]?.trim()),
  }));
}

export function isConfigured(): boolean {
  return envStatus().every((entry) => entry.set);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The emulator's URL when `pnpm dev:emulator` started this app, otherwise
 * `null`. It sets `PLANEWARD_BASE_URL` to a loopback address and a
 * `pwa_local_` app secret; checking both tells it apart from a Planeward
 * checkout running on localhost. Never returns the secret.
 */
export function emulatorUrl(): string | null {
  const baseUrl = process.env.PLANEWARD_BASE_URL?.trim();
  const secret = process.env.PLANEWARD_APP_SECRET?.trim() ?? "";
  if (!baseUrl || !URL.canParse(baseUrl) || !secret.startsWith("pwa_local_")) {
    return null;
  }
  const url = new URL(baseUrl);
  return LOOPBACK_HOSTS.has(url.hostname) ? url.origin : null;
}
