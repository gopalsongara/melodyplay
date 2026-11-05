import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const controllerPath = path.join(
  __dirname,
  "../src/controllers/library.controller.js",
);

describe("library user isolation (static analysis)", () => {
  it("scopes every Mongo query to userId from auth", () => {
    const src = fs.readFileSync(controllerPath, "utf8");

    // Controllers must obtain the authenticated user
    assert.match(src, /getAuthUserId|getUserId\(req\)/);

    // Dangerous unscoped finds should not appear
    assert.doesNotMatch(src, /Favorite\.find\(\s*\{?\s*\}?\s*\)/);
    assert.doesNotMatch(src, /History\.find\(\s*\{?\s*\}?\s*\)/);
    assert.doesNotMatch(src, /UserPlaylist\.find\(\s*\{?\s*\}?\s*\)/);

    // Favorites / history / playlists must include userId filters
    assert.match(src, /Favorite\.find\(\{\s*userId:/);
    assert.match(src, /History\.find\(\{\s*userId:/);
    assert.match(src, /UserPlaylist\.find\(\{\s*userId:/);
    assert.match(src, /UserPlaylist\.findOne\(\{[\s\S]*userId:/);
    assert.match(src, /Favorite\.findOneAndDelete\(\{[\s\S]*userId:/);
    assert.match(src, /UserPlaylist\.findOneAndDelete\(\{[\s\S]*userId:/);
  });
});
