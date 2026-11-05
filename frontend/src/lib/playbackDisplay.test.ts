import { describe, expect, it } from "vitest";
import {
  formatTrackDuration,
  getDisplayDurationSeconds,
  getPlaybackLabel,
  preferFullSibling,
} from "./playbackDisplay";

describe("playbackDisplay", () => {
  it("never shows catalog duration for preview tracks", () => {
    expect(
      getDisplayDurationSeconds({
        duration: 261,
        isPreview: true,
        previewDuration: 30,
      }),
    ).toBe(30);
    expect(
      formatTrackDuration(
        getDisplayDurationSeconds({
          duration: 261,
          isPreview: true,
          previewDuration: 30,
        }),
      ),
    ).toBe("0:30");
  });

  it("keeps full duration for non-preview tracks", () => {
    expect(
      getDisplayDurationSeconds({
        duration: 210,
        isPreview: false,
      }),
    ).toBe(210);
  });

  it("labels previews clearly", () => {
    expect(getPlaybackLabel({ isPreview: true, provider: "apple" })).toBe(
      "Apple · 30s",
    );
    expect(getPlaybackLabel({ isPreview: false, provider: "audius" })).toBe(
      "Full",
    );
  });

  it("prefers a full sibling over a preview with the same title", () => {
    const tracks = [
      {
        _id: "1",
        title: "Tum Hi Ho",
        artist: "Arijit Singh",
        imgUrl: "",
        audioUrl: "preview",
        duration: 30,
        isPreview: true,
        provider: "apple",
      },
      {
        _id: "2",
        title: "Tum Hi Ho",
        artist: "Cover Band",
        imgUrl: "",
        audioUrl: "",
        duration: 240,
        isPreview: false,
        provider: "audius",
        needsStreamResolve: true,
        playable: true,
      },
    ];
    const preferred = preferFullSibling(tracks as never, 0);
    expect(preferred.index).toBe(1);
    expect(preferred.track.isPreview).toBe(false);
  });
});
