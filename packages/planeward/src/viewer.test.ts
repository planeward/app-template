import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { APP_JWKS_PATH } from "@planeward/sdk/server";

import { authenticateViewer, readBearerToken } from "./viewer";

const APP_ID = "app_template";
const KID = "test-key";

let server: Server;
let baseUrl: string;
let privateKey: KeyObject;

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/** RS256 JWT signed with node:crypto, shaped like a Planeward viewer token. */
function signToken({
  audience = APP_ID,
  role = "member",
  issuer = baseUrl,
  expiresInSeconds = 300,
}: {
  audience?: string;
  role?: "member" | "admin";
  issuer?: string;
  expiresInSeconds?: number;
} = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: KID })
  );
  const payload = base64url(
    JSON.stringify({
      iss: issuer,
      aud: audience,
      sub: "cm_1",
      iat: now,
      exp: now + expiresInSeconds,
      workspaceId: "ws_1",
      installationId: "inst_1",
      channelId: "chan_1",
      view: "experience",
      role,
      name: "Ada",
      avatar: null,
    })
  );
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`),
    privateKey
  );
  return `${header}.${payload}.${base64url(signature)}`;
}

const request = (authorization?: string) =>
  new Request("http://app.test/api/posts", {
    headers: authorization ? { Authorization: authorization } : {},
  });

const verify = (req: Request, role?: "admin") =>
  authenticateViewer(req, { role }, { appId: APP_ID, baseUrl });

async function errorOf(response: Response) {
  return ((await response.json()) as { error: string }).error;
}

before(async () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = pair.privateKey;
  const jwk = pair.publicKey.export({ format: "jwk" });
  const jwks = JSON.stringify({
    keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }],
  });
  server = createServer((req, res) => {
    if (req.url === APP_JWKS_PATH) {
      res.writeHead(200, { "content-type": "application/json" }).end(jwks);
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

describe("readBearerToken", () => {
  it("accepts any scheme casing and rejects other schemes", () => {
    assert.equal(readBearerToken(request("Bearer abc")), "abc");
    assert.equal(readBearerToken(request("bearer abc")), "abc");
    assert.equal(readBearerToken(request("BEARER   abc  ")), "abc");
    assert.equal(readBearerToken(request("Basic abc")), null);
    assert.equal(readBearerToken(request("Bearer")), null);
    assert.equal(readBearerToken(request("Bearer a b")), null);
    assert.equal(readBearerToken(request()), null);
  });
});

describe("authenticateViewer", () => {
  it("401s without a token", async () => {
    const result = await verify(request());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.response.status, 401);
    assert.equal(await errorOf(result.response), "Missing viewer token");
    assert.equal(result.response.headers.get("www-authenticate"), "Bearer");
  });

  it("401s a garbage token with a generic message", async () => {
    const result = await verify(request("Bearer not.a.jwt"));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.response.status, 401);
    assert.equal(await errorOf(result.response), "Invalid viewer token");
  });

  it("returns the verified viewer for a valid RS256 token", async () => {
    const result = await verify(request(`Bearer ${signToken()}`));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.viewer.aud, APP_ID);
    assert.equal(result.viewer.installationId, "inst_1");
    assert.equal(result.viewer.channelId, "chan_1");
    assert.equal(result.viewer.role, "member");
  });

  it("401s a token for another app with the clear aud message", async () => {
    const result = await verify(
      request(`Bearer ${signToken({ audience: "app_other" })}`)
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.response.status, 401);
    const error = await errorOf(result.response);
    assert.match(error, /app_other/);
    assert.match(error, new RegExp(APP_ID));
    assert.match(error, /PLANEWARD_APP_ID/);
  });

  it("401s expired tokens and foreign issuers generically", async () => {
    for (const token of [
      signToken({ expiresInSeconds: -60 }),
      signToken({ issuer: "https://evil.test" }),
    ]) {
      const result = await verify(request(`Bearer ${token}`));
      assert.equal(result.ok, false);
      if (result.ok) continue;
      assert.equal(result.response.status, 401);
      assert.equal(await errorOf(result.response), "Invalid viewer token");
    }
  });

  it("401s a token signed by another key", async () => {
    const valid = signToken();
    const [header, payload] = valid.split(".");
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const forged = sign(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      other.privateKey
    );
    const result = await verify(
      request(`Bearer ${header}.${payload}.${base64url(forged)}`)
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(await errorOf(result.response), "Invalid viewer token");
  });

  it("403s a member when admin is required and admits an admin", async () => {
    const member = await verify(request(`Bearer ${signToken()}`), "admin");
    assert.equal(member.ok, false);
    if (!member.ok) {
      assert.equal(member.response.status, 403);
      assert.equal(await errorOf(member.response), "Staff only");
    }

    const admin = await verify(
      request(`Bearer ${signToken({ role: "admin" })}`),
      "admin"
    );
    assert.equal(admin.ok, true);
  });
});
