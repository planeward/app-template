import type { NextConfig } from "next";

// The dev server only serves its assets to `localhost`. When testing through a
// tunnel (see README), list the tunnel hostname(s), comma-separated.
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
