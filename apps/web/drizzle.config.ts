import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load env files. Fall back to this app's `.env` when
// DATABASE_URL is not already set (turbo, Vercel).
const appEnv = fileURLToPath(new URL(".env", import.meta.url));
if (!process.env.DATABASE_URL && existsSync(appEnv)) {
  process.loadEnvFile(appEnv);
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
