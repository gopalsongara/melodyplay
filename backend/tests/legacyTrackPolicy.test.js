import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isUntrustedCatalogueTrack,
  isDiscoverableTrack,
  sanitizePersistedTrack,
  filterDiscoverableTracks,
  LEGACY_POLICY_NOTES,
} from "../src/services/music/legacyTrackPolicy.js";
import {
  isProviderAllowed,
  filterDiscoverableEntities,
} from "../src/services/music/providerRegistry.js";
import { resolveStream, resolvePreview } from "../src/services/music/musicStream.service.js";
import { lookupOfficialArtists } from "../src/services/music/queryNormalize.js";

describe("legacy track policy", () => {
  it("blocks Deezer providers", () => {
    assert.equal(isProviderAllowed("deezer"), false);
    assert.equal(
      isUntrustedCatalogueTrack({
        provider: "deezer",
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
      }),
      true,
    );
    assert.equal(
      sanitizePersistedTrack({
        provider: "deezer",
        title: "X",
        audioUrl: "https://cdnt-preview.dzcdn.net/x.mp3",
      }),
      null,
    );
  });

  it("blocks Songs.PK labelled Audius uploads", () => {
    const track = {
      provider: "audius",
      title: "[Songs.PK] 13 - Yo Yo Hits - Punjabiyaan Di Battery",
      artist: "Uploader",
    };
    assert.equal(isUntrustedCatalogueTrack(track), true);
    assert.equal(isDiscoverableTrack(track), false);
    assert.equal(
      filterDiscoverableTracks([track, { provider: "apple", title: "Ok" }])
        .length,
      1,
    );
    assert.equal(
      filterDiscoverableEntities([
        track,
        { provider: "apple", title: "Qaafirana", artist: "Arijit Singh" },
      ]).length,
      1,
    );
  });

  it("rejects Deezer stream and preview", async () => {
    await assert.rejects(
      () => resolveStream({ source: "deezer", id: "1" }),
      (err) => err.status === 410,
    );
    await assert.rejects(
      () => resolvePreview({ source: "deezer", id: "1" }),
      (err) => err.status === 410,
    );
  });

  it("rejects Songs.PK audius stream by metadata", async () => {
    await assert.rejects(
      () => resolveStream({ source: "audius", id: "KdlRl" }),
      (err) => err.status === 403 || err.status === 502 || err.status === 404,
    );
  });

  it("knows official artists for Qaafirana", () => {
    const artists = lookupOfficialArtists("Qaafirana");
    assert.ok(artists?.some((a) => a.includes("arijit")));
  });

  it("documents policy notes", () => {
    assert.ok(LEGACY_POLICY_NOTES.deezer);
    assert.ok(LEGACY_POLICY_NOTES.songsPk);
  });
});
