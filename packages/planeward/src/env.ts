import "server-only";

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { APP_SECRET_PREFIX } from "@planeward/sdk/server";

export const env = createEnv({
  server: {
    /** Must equal the viewer token's `aud`. One app id per deployment. */
    PLANEWARD_APP_ID: z.string().min(1),
    /** App secret for the Planeward API. */
    PLANEWARD_APP_SECRET: z.string().startsWith(APP_SECRET_PREFIX),
    /** Signing secret for `x-planeward-signature`. */
    PLANEWARD_WEBHOOK_SECRET: z.string().min(1),
    /** Planeward deployment that issues viewer tokens and serves the API. */
    PLANEWARD_BASE_URL: z.url().default("https://app.planeward.com"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  // Lets `next build` and CI run without real credentials.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
