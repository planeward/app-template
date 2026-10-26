import {
  PlanewardTokenAudienceError,
  verifyPlanewardToken,
  type AppViewerTokenClaims,
} from "@planeward/sdk/server";

export type Viewer = AppViewerTokenClaims;

export type RequireViewerOptions = {
  /** `"admin"` allows only workspace staff (`role === "admin"`). */
  role?: "admin";
};

export type RequireViewerResult =
  { ok: true; viewer: Viewer } | { ok: false; response: Response };

export type ViewerVerifyConfig = {
  appId: string;
  baseUrl?: string;
};

const BEARER = /^Bearer[ \t]+([^\s]+)[ \t]*$/i;

/** The token from `Authorization: Bearer <token>`, or null. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  return BEARER.exec(header.trim())?.[1] ?? null;
}

export function jsonError(
  status: number,
  error: string,
  headers?: HeadersInit
): Response {
  const response = Response.json({ error }, { status, headers });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const unauthorized = (error: string) =>
  jsonError(401, error, { "WWW-Authenticate": "Bearer" });

/**
 * Verify the viewer token on a request. Every claim on the returned viewer has
 * been checked against Planeward's JWKS (signature, issuer, `aud` = this app,
 * expiry), so it is safe to scope data by `installationId` / `channelId` / `sub`.
 */
export async function authenticateViewer(
  request: Request,
  options: RequireViewerOptions,
  config: ViewerVerifyConfig
): Promise<RequireViewerResult> {
  const token = readBearerToken(request);
  if (!token) {
    return { ok: false, response: unauthorized("Missing viewer token") };
  }

  let viewer: Viewer;
  try {
    viewer = await verifyPlanewardToken(token, {
      appId: config.appId,
      baseUrl: config.baseUrl,
    });
  } catch (error) {
    if (error instanceof PlanewardTokenAudienceError) {
      // App ids are not secret, and the message says exactly what to fix.
      return { ok: false, response: unauthorized(error.message) };
    }
    // Log the reason server-side only (expired, bad signature, JWKS
    // unreachable…); never echo verifier internals or the token.
    console.warn(
      "[planeward] viewer token rejected:",
      error instanceof Error ? `${error.name}: ${error.message}` : error
    );
    return { ok: false, response: unauthorized("Invalid viewer token") };
  }

  if (options.role === "admin" && viewer.role !== "admin") {
    return { ok: false, response: jsonError(403, "Staff only") };
  }

  return { ok: true, viewer };
}
