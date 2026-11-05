import type { NextConfig } from "next";

// `next dev` serves its dev resources (`/_next/*`, HMR) only to `localhost`.
// If you load the app UI through a tunnel (docs/going-live.md), list the
// tunnel hostname(s), comma-separated. The emulator, localhost URLs and a
// tunnel used only for webhooks don't need it.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/planeward"],
  allowedDevOrigins,
  // No `headers()` here on purpose: this app runs in an iframe on any
  // Planeward community host, including custom domains. Do not add
  // `X-Frame-Options` or a restrictive CSP `frame-ancestors`.
};

export default nextConfig;
