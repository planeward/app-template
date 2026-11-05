import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { emulatorUrl } from "./env-status";

const original = {
  PLANEWARD_BASE_URL: process.env.PLANEWARD_BASE_URL,
  PLANEWARD_APP_SECRET: process.env.PLANEWARD_APP_SECRET,
};

function setEnv(baseUrl: string | undefined, secret: string | undefined) {
  for (const [name, value] of [
    ["PLANEWARD_BASE_URL", baseUrl],
    ["PLANEWARD_APP_SECRET", secret],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

afterEach(() => {
  setEnv(original.PLANEWARD_BASE_URL, original.PLANEWARD_APP_SECRET);
});

describe("emulatorUrl", () => {
  it("returns the emulator origin for a loopback base URL and local secret", () => {
    for (const value of [
      "http://127.0.0.1:4600",
      "http://localhost:4600/",
      "http://[::1]:4600",
    ]) {
      setEnv(value, "pwa_local_abc");
      assert.equal(emulatorUrl(), new URL(value).origin);
    }
  });

  it("returns null for a Planeward checkout on localhost", () => {
    setEnv("http://localhost:3000", "pwa_abc");
    assert.equal(emulatorUrl(), null);
  });

  it("returns null for hosted Planeward, unset or invalid base URLs", () => {
    for (const value of ["https://app.planeward.com", "", "not a url"]) {
      setEnv(value, "pwa_local_abc");
      assert.equal(emulatorUrl(), null);
    }
    setEnv(undefined, "pwa_local_abc");
    assert.equal(emulatorUrl(), null);
  });
});
