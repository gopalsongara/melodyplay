import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchTracks, searchAlbums, searchArtists } from "../src/services/music/musicSearch.service.js";
import { isProviderAllowed } from "../src/services/music/providerRegistry.js";
import { detectSearchIntent } from "../src/services/music/queryNormalize.js";

describe("search relevance — Shreya / Arijit style queries", () => {
  it("detects artist-ish intent for Shreya Ghoshal", () => {
    const intent = detectSearchIntent("Shreya Ghoshal");
    assert.equal(intent.intent, "ARTIST");
    assert.equal(intent.artistIntent, true);
  });

  it("detects album intent for Shreya Ghoshal albums", () => {
    const intent = detectSearchIntent("Shreya Ghoshal albums");
    assert.equal(intent.intent, "ALBUM");
    assert.match(intent.entityQuery, /shreya ghoshal/i);
  });

  it("detects artist songs intent", () => {
    const intent = detectSearchIntent("Shreya Ghoshal songs");
    assert.equal(intent.intent, "ARTIST");
    assert.equal(intent.wantSongs, true);
  });

  it("returns multiple relevant Shreya Ghoshal songs (Apple-backed)", async () => {
    const res = await searchTracks({ q: "Shreya Ghoshal", limit: 20 });
    assert.equal(res.query, "Shreya Ghoshal");
    assert.ok(res.tracks.length >= 5, `expected >=5 tracks, got ${res.tracks.length}`);
    const relevant = res.tracks.filter((t) =>
      String(t.artist || "")
        .toLowerCase()
        .includes("shreya"),
    );
    assert.ok(
      relevant.length >= 5,
      `expected >=5 artist-credited tracks, got ${relevant.length}; top=${res.tracks
        .slice(0, 5)
        .map((t) => `${t.title} — ${t.artist}`)
        .join(" | ")}`,
    );
    assert.equal(res.tracks.some((t) => t.provider === "deezer"), false);
  });

  it("returns Shreya-credited albums for artist album search", async () => {
    const res = await searchAlbums({ q: "Shreya Ghoshal", limit: 15 });
    assert.ok(res.albums.length >= 3, `albums=${res.albums.length}`);
    const relevant = res.albums.filter((a) =>
      String(a.artist || "")
        .toLowerCase()
        .includes("shreya"),
    );
    assert.ok(
      relevant.length >= 3,
      `relevant albums=${relevant.length}; sample=${res.albums
        .slice(0, 5)
        .map((a) => `${a.title} — ${a.artist}`)
        .join(" | ")}`,
    );
  });

  it("resolves Arjit Singh typo to Arijit-related artists", async () => {
    const res = await searchArtists({ q: "Arjit Singh", limit: 5 });
    assert.ok(res.artists.length >= 1);
    assert.ok(
      res.artists.some((a) =>
        /arijit/i.test(a.name || a.title || ""),
      ),
    );
  });

  it("keeps Deezer blocked", () => {
    assert.equal(isProviderAllowed("deezer"), false);
  });
});
