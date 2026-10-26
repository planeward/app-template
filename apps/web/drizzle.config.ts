import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load env files. Fall back to the repo root `.env`
// when DATABASE_URL is not already set (turbo passes it through).
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
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
