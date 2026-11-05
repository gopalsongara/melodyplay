import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveStream, resolvePreview } from "../src/services/music/musicStream.service.js";
import {
  isProviderAllowed,
  parseProviderList,
  filterAllowedEntities,
  DEFAULT_TRACK_PROVIDERS,
  DEFAULT_CATALOG_PROVIDERS,
} from "../src/services/music/providerRegistry.js";
import { listProviderCapabilities } from "../src/services/music/providerCapabilities.js";

describe("Deezer removal", () => {
  it("blocks Deezer in the provider registry", () => {
    assert.equal(isProviderAllowed("deezer"), false);
    assert.equal(
      parseProviderList("deezer,jiosaavn,audius").includes("deezer"),
      false,
    );
    assert.equal(DEFAULT_TRACK_PROVIDERS.includes("deezer"), false);
    assert.equal(DEFAULT_CATALOG_PROVIDERS.includes("deezer"), false);
  });

  it("strips Deezer from discovery/search entity lists", () => {
    const out = filterAllowedEntities([
      { provider: "deezer", id: "1" },
      { provider: "audius", id: "2" },
    ]);
    assert.deepEqual(
      out.map((x) => x.provider),
      ["audius"],
    );
  });

  it("does not advertise Deezer capabilities", () => {
    assert.equal(
      listProviderCapabilities().some((c) => c.providerName === "deezer"),
      false,
    );
  });

  it("rejects Deezer stream requests (no preview fallback)", async () => {
    await assert.rejects(
      () => resolveStream({ source: "deezer", id: "999" }),
      (err) => err?.status === 410,
    );
  });

  it("rejects Deezer preview requests", async () => {
    await assert.rejects(
      () => resolvePreview({ source: "deezer", id: "999" }),
      (err) => err?.status === 410,
    );
  });
});
