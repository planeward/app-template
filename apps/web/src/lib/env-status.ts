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
