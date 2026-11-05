import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.CLERK_PUBLISHABLE_KEY =
  process.env.CLERK_PUBLISHABLE_KEY || "pk_test_placeholder";
process.env.CLERK_SECRET_KEY =
  process.env.CLERK_SECRET_KEY || "sk_test_placeholder";

const { createApp } = await import("../src/app.js");

const listen = (app) =>
  new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });

const request = (port, path, { method = "GET", headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* ignore */
          }
          resolve({ status: res.statusCode, headers: res.headers, json, raw });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });

describe("HTTP health + library auth", () => {
  let server;
  let port;

  before(async () => {
    const app = createApp();
    ({ server, port } = await listen(app));
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("GET /api/health returns ok and provider capabilities", async () => {
    const res = await request(port, "/api/health");
    assert.equal(res.status, 200, res.raw);
    assert.equal(res.json.success, true);
    assert.equal(res.json.data.status, "ok");
    assert.ok(Array.isArray(res.json.data.providers.capabilities));
    assert.equal(
      res.json.data.providers.capabilities.some((p) => p.providerName === "deezer"),
      false,
    );
    assert.ok(
      res.json.data.providers.capabilities.some((p) => p.providerName === "audius"),
    );
  });

  it("GET /api/library/favorites without auth returns 401", async () => {
    const res = await request(port, "/api/library/favorites");
    assert.equal(res.status, 401, res.raw);
  });

  it("GET /api/library/history without auth returns 401", async () => {
    const res = await request(port, "/api/library/history");
    assert.equal(res.status, 401, res.raw);
  });

  it("GET /api/library/playlists without auth returns 401", async () => {
    const res = await request(port, "/api/library/playlists");
    assert.equal(res.status, 401, res.raw);
  });
});
