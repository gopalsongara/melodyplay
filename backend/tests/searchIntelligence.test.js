import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchVariants,
  detectSearchIntent,
  editDistance,
  stringSimilarity,
  normalizeForMatch,
} from "../src/services/music/queryNormalize.js";
import { dedupeTracks, trackFingerprint } from "../src/services/music/dedupe.js";
import { mapArtist, mapAlbum } from "../src/services/music/music.mapper.js";
import { isProviderAllowed } from "../src/services/music/providerRegistry.js";
import { runProviderTasks } from "../src/services/music/searchOrchestrator.js";

describe("queryNormalize", () => {
  it("expands common artist typos without mutating original", () => {
    const { original, primary, variants } = buildSearchVariants("Arjit Singh");
    assert.equal(original, "Arjit Singh");
    assert.equal(normalizeForMatch(primary), "arijit singh");
    assert.ok(variants.some((v) => normalizeForMatch(v.text) === "arijit singh"));
  });

  it("expands title typos like Keseeriya", () => {
    const { primary } = buildSearchVariants("Keseeriya");
    assert.equal(normalizeForMatch(primary), "kesariya");
  });

  it("handles Tumhi Ho spacing variants", () => {
    const { primary } = buildSearchVariants("Tumhi Ho");
    assert.equal(normalizeForMatch(primary), "tum hi ho");
  });

  it("bounds edit distance", () => {
    assert.equal(editDistance("arijit", "arjit", 2), 1);
    assert.equal(editDistance("arijit", "zzzzzz", 2), Infinity);
  });

  it("scores exact similarity higher than weak overlap", () => {
    assert.ok(stringSimilarity("Tum Hi Ho", "Tum Hi Ho") > 0.99);
    assert.ok(
      stringSimilarity("Arijit Singh", "Arjit Singh") >
        stringSimilarity("Arijit Singh", "Random Band"),
    );
  });

  it("detects mood-ish intent", () => {
    const intent = detectSearchIntent("Hindi sad songs");
    assert.ok(["MOOD", "GENRE"].includes(intent.intent));
  });
});

describe("orchestrator circuit breaker", () => {
  it("opens after repeated failures then recovers", async () => {
    const {
      runProviderTasks,
      resetCircuits,
      getProviderHealth,
    } = await import("../src/services/music/searchOrchestrator.js");
    resetCircuits();
    for (let i = 0; i < 4; i++) {
      await runProviderTasks(
        [
          {
            name: "flaky-provider",
            run: async () => {
              const err = new Error("boom");
              err.status = 502;
              throw err;
            },
          },
        ],
        { timeoutMs: 200 },
      );
    }
    const health = getProviderHealth();
    assert.ok(health["flaky-provider"]?.open || health["flaky-provider"]?.failures >= 4);
    const blocked = await runProviderTasks([
      {
        name: "flaky-provider",
        run: async () => "should-not-run",
      },
    ]);
    assert.equal(blocked.errors[0]?.circuitOpen, true);
    resetCircuits();
  });
});

describe("dedupeTracks", () => {
  it("never merges on title alone", () => {
    const out = dedupeTracks([
      {
        title: "Believer",
        artist: "Imagine Dragons",
        provider: "apple",
        providerId: "1",
        duration: 30,
        isPreview: true,
      },
      {
        title: "Believer",
        artist: "Cover Kid",
        provider: "audius",
        providerId: "2",
        duration: 200,
        isPreview: false,
      },
    ]);
    assert.equal(out.length, 2);
  });

  it("prefers full track over preview for same fingerprint", () => {
    const out = dedupeTracks([
      {
        title: "Kesariya",
        artist: "Arijit Singh",
        provider: "apple",
        providerId: "a",
        duration: 30,
        isPreview: true,
      },
      {
        title: "Kesariya",
        artist: "Arijit Singh",
        provider: "jiosaavn",
        providerId: "b",
        duration: 268,
        isPreview: false,
        audioUrl: "https://example.com/a.mp4",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].provider, "jiosaavn");
    assert.equal(out[0].isPreview, false);
    assert.ok(out[0].alternateSources?.length);
  });

  it("builds stable fingerprints", () => {
    assert.ok(
      trackFingerprint({
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        duration: 261,
      }),
    );
  });
});

describe("artwork mapping regressions", () => {
  it("maps JioSaavn artists with type:artist using image[] (not Deezer fields)", () => {
    const artist = mapArtist(
      {
        id: "xyz",
        type: "artist",
        name: "Arijit Singh",
        image: [
          { quality: "50x50", url: "https://cdn.example/50.jpg" },
          { quality: "500x500", url: "https://cdn.example/500.jpg" },
        ],
      },
      "jiosaavn",
    );
    assert.equal(artist.provider, "jiosaavn");
    assert.equal(artist.imgUrl, "https://cdn.example/500.jpg");
  });

  it("maps JioSaavn albums with image arrays", () => {
    const album = mapAlbum(
      {
        id: "alb1",
        name: "Kesariya",
        artists: { primary: [{ name: "Arijit Singh" }] },
        image: [{ quality: "500x500", url: "https://cdn.example/alb.jpg" }],
      },
      "jiosaavn",
    );
    assert.equal(album.imgUrl, "https://cdn.example/alb.jpg");
  });

  it("never maps Deezer artists", () => {
    assert.equal(
      mapArtist({ id: "1", type: "artist", name: "X", picture_xl: "u" }, "deezer"),
      null,
    );
  });
});

describe("orchestration isolation", () => {
  it("returns partial results when one provider fails", async () => {
    const { results, errors } = await runProviderTasks([
      {
        name: "ok",
        run: async () => [{ id: 1 }],
      },
      {
        name: "bad",
        run: async () => {
          throw new Error("boom");
        },
      },
    ]);
    assert.equal(results.length, 1);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].provider, "bad");
  });

  it("times out a hung provider without blocking others", async () => {
    const { results, errors } = await runProviderTasks(
      [
        {
          name: "fast",
          run: async () => "yes",
        },
        {
          name: "slow",
          run: async () =>
            new Promise((resolve) => setTimeout(() => resolve("late"), 5000)),
        },
      ],
      { timeoutMs: 80 },
    );
    assert.equal(results.length, 1);
    assert.equal(errors[0].provider, "slow");
  });
});

describe("deezer remains blocked", () => {
  it("rejects deezer provider eligibility", () => {
    assert.equal(isProviderAllowed("deezer"), false);
  });
});
