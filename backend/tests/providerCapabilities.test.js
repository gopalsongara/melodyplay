import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAttemptJioSaavnFullPlayback,
  getJioSaavnAuthorizationStatus,
  getProviderCapability,
  listProviderCapabilities,
} from "../src/services/music/providerCapabilities.js";
import {
  isProviderAllowed,
  parseProviderList,
  filterAllowedEntities,
  DEFAULT_TRACK_PROVIDERS,
} from "../src/services/music/providerRegistry.js";

describe("providerCapabilities", () => {
  it("marks Deezer as removed (not active / not preview-capable in MelodyPlay)", () => {
    const deezer = getProviderCapability("deezer");
    assert.equal(deezer.supportsFullPlayback, false);
    assert.equal(deezer.supportsPreview, false);
    assert.equal(deezer.authorizationStatus, "removed");
    assert.equal(deezer.fullPlaybackAttemptAllowed, false);
  });

  it("does not list Deezer among active providers", () => {
    const names = listProviderCapabilities().map((c) => c.providerName);
    assert.equal(names.includes("deezer"), false);
    assert.ok(names.includes("audius"));
    assert.ok(names.includes("apple"));
    assert.ok(names.includes("jiosaavn"));
  });

  it("lists required capability fields for every provider", () => {
    for (const cap of listProviderCapabilities()) {
      assert.ok(cap.providerName);
      assert.equal(typeof cap.supportsFullPlayback, "boolean");
      assert.equal(typeof cap.supportsPreview, "boolean");
      assert.equal(typeof cap.supportsSeeking, "boolean");
      assert.equal(typeof cap.requiresAuthentication, "boolean");
      assert.ok(cap.authorizationStatus);
    }
  });

  it("disables JioSaavn upgrades in production without attestation", () => {
    const prevNode = process.env.NODE_ENV;
    const prevAuth = process.env.JIOSAAVN_AUTHORIZED;
    process.env.NODE_ENV = "production";
    delete process.env.JIOSAAVN_AUTHORIZED;
    assert.equal(canAttemptJioSaavnFullPlayback(), false);
    assert.equal(getJioSaavnAuthorizationStatus(), "disabled_until_attested");
    process.env.JIOSAAVN_AUTHORIZED = "true";
    assert.equal(canAttemptJioSaavnFullPlayback(), true);
    process.env.NODE_ENV = prevNode;
    if (prevAuth === undefined) delete process.env.JIOSAAVN_AUTHORIZED;
    else process.env.JIOSAAVN_AUTHORIZED = prevAuth;
  });
});

describe("providerRegistry", () => {
  it("blocks Deezer even when requested explicitly", () => {
    assert.equal(isProviderAllowed("deezer"), false);
    assert.equal(isProviderAllowed("Deezer"), false);
    const parsed = parseProviderList("jiosaavn,deezer,audius");
    assert.deepEqual(parsed, ["jiosaavn", "audius"]);
    assert.equal(parsed.includes("deezer"), false);
  });

  it("defaults exclude Deezer", () => {
    assert.equal(DEFAULT_TRACK_PROVIDERS.includes("deezer"), false);
    assert.ok(DEFAULT_TRACK_PROVIDERS.includes("audius"));
  });

  it("filters Deezer entities from result sets", () => {
    const filtered = filterAllowedEntities([
      { provider: "audius", title: "A" },
      { provider: "deezer", title: "B" },
      { provider: "jiosaavn", title: "C" },
    ]);
    assert.equal(filtered.length, 2);
    assert.equal(
      filtered.some((t) => t.provider === "deezer"),
      false,
    );
  });
});
