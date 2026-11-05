import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withHonestPlaybackDuration } from "../src/lib/playbackHonesty.js";

describe("playbackHonesty", () => {
  it("clamps preview duration to 30s even if catalog duration is long", () => {
    const track = withHonestPlaybackDuration(
      { title: "Tum Hi Ho", duration: 261, isPreview: false },
      { isPreview: true, previewDuration: 30 },
    );
    assert.equal(track.isPreview, true);
    assert.equal(track.duration, 30);
    assert.equal(track.previewDuration, 30);
  });

  it("leaves full tracks unchanged", () => {
    const track = withHonestPlaybackDuration(
      { title: "Song", duration: 210, isPreview: false },
      { isPreview: false },
    );
    assert.equal(track.isPreview, false);
    assert.equal(track.duration, 210);
  });
});
