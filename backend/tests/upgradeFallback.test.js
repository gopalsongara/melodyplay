import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const streamPath = path.join(
  __dirname,
  "../src/services/music/musicStream.service.js",
);

describe("upgrade fallback wiring", () => {
  it("attempts Audius full-track upgrade when JioSaavn is unavailable", () => {
    const src = fs.readFileSync(streamPath, "utf8");
    assert.match(src, /upgradeViaAudius/);
    assert.match(src, /upgradeViaJioSaavn/);
    assert.match(src, /\/v1\/audius\/search\/tracks/);
    // Must not abort the whole upgrade when JioSaavn is disallowed
    assert.doesNotMatch(
      src,
      /if \(!canAttemptJioSaavnFullPlayback\(\)\) \{\s*return null;\s*\}/,
    );
  });
});
