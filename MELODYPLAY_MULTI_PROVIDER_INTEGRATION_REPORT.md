# MelodyPlay — Multi-Provider Catalogue & Search Upgrade

**Date:** 2026-11-04  
**Checkpoint:** `stash@{0}: checkpoint-multi-provider-catalogue-20261104`  
**Evaluation report:** `MULTI_PROVIDER_EVALUATION_REPORT.md`  
**Deploy:** Not performed.

---

## 1. Providers tested

| Provider | Result |
| --- | --- |
| JioSaavn (existing sidecar) | PARTIAL — unreachable locally this session |
| Audius (Saya) | PARTIAL — works but noisy for Bollywood artist queries |
| Apple / iTunes | WORKING — primary relevance source |
| MusicBrainz | WORKING — metadata / discography enrichment |
| Cover Art Archive | WORKING — optional missing-art enrichment |
| Radio Browser | Preserved |
| Internet Archive | Capability retained |
| Deezer | Blocked |
| node-youtube-music | UNAVAILABLE (404 all calls) |
| ytmusicapi | Rejected (Python infra not needed) |
| Gaana (notdeltaxd) | UNAVAILABLE (no public deploy) |
| Gaana (shnwazdev) | UNAVAILABLE (HTTP 402) |
| Beatbump | Reference only |

---

## 2. Providers integrated / improved

**Integrated as adapters (unique or high-quality coverage):**
- **Apple adapter** — search songs/artists/albums; artist songs & albums via iTunes lookup; album tracks
- **MusicBrainz adapter** — artist resolve + release-group albums (metadata only)

**Improved existing:**
- Relevance-first ranking (playback is a tiny tie-breaker only)
- Artist-intent path: iTunes artist discography injection
- Album filtering by artist credit
- Playback labels: `playbackType` / `playbackAvailable`
- Apple artist detail pages now return **topTracks** (previews) + albums

**Preserved:** JioSaavn, Audius, Radio Browser, Archive, Deezer block, player/library.

---

## 3. Rejected providers (and why)

| Candidate | Why rejected |
| --- | --- |
| node-youtube-music | All API calls returned HTTP 404 in isolated eval |
| ytmusicapi | Node YT Music already failed; no Python microservice without unique proven coverage; embed-only policy anyway |
| Gaana wrappers | Public hosts 402/404; advertised decrypted HLS is **not** treated as authorized full playback; overlaps JioSaavn Hindi catalogue |
| Beatbump | Architecture reference only — no code copied |

---

## 4. Real API test highlights

- **Shreya Ghoshal** iTunes songs: 25/25 artist-credited  
- **Shreya Ghoshal** iTunes albums: 25/25 artist-credited  
- **Audius** Shreya query: high ringtone/lofi noise (demoted in ranking)  
- **node-youtube-music**: 0/13 calls succeeded  
- **Gaana public**: 402 / 404  

Automated relevance suite (live network):
- `searchTracks("Shreya Ghoshal")` → ≥5 tracks with “shreya” in artist credit — **pass**
- `searchAlbums("Shreya Ghoshal")` → ≥3 Shreya-credited albums — **pass**
- `searchArtists("Arjit Singh")` → Arijit match — **pass**

---

## 5. Search relevance comparison

| Before | After |
| --- | --- |
| Audius full tracks could outrank exact Apple artist matches | Relevance (title/artist similarity) dominates; playback ±8 only |
| Artist query returned ringtone/cover spam | Artist-intent filter + Apple discography lookup |
| Albums mixed unrelated collections | `filterAlbumsForQuery` + artist album discography |
| Weak typo handling | Existing aliases + Apple fuzzy search |

---

## 6. Song / unique coverage (illustrative)

With Jio down, Apple+Audius still return dense Shreya results via Apple discography (lookup up to 50 songs) plus filtered search. Unique catalogue growth this cycle is **Apple depth + MusicBrainz metadata**, not a new unauthorized stream source.

---

## 7. Artist & album coverage

- Artist search: Apple + MusicBrainz (name similarity ≥ 0.55)
- Artist page (`provider=apple`): popular songs (preview) + albums/singles
- Artist page (`provider=musicbrainz`): albums/EPs/singles metadata only
- Album detail: Jio (full when authorized) + Apple iTunes lookup tracks (preview)

---

## 8. Playback capabilities & restrictions

| Source | playbackType |
| --- | --- |
| Apple | `preview` |
| Audius / Jio (when playable) | `authorized_full_stream` (subject to existing attestation for Jio) |
| MusicBrainz | `metadata_only` |
| YouTube | **Not integrated** — no stream extraction |
| Gaana | **Not integrated** — no unauthorized HLS |
| Deezer | Blocked (410) |

---

## 9. Files changed

### New
- `backend/src/services/music/adapters/providerAdapter.js`
- `backend/src/services/music/adapters/apple.adapter.js`
- `backend/src/services/music/adapters/musicbrainz.adapter.js`
- `backend/src/services/music/adapters/index.js`
- `backend/tests/searchRelevance.test.js`
- `MULTI_PROVIDER_EVALUATION_REPORT.md`
- `MELODYPLAY_MULTI_PROVIDER_INTEGRATION_REPORT.md`
- `_provider_eval/multi/` (isolated eval; not a production dependency)

### Modified
- `backend/src/services/music/musicSearch.service.js`
- `backend/src/services/music/musicDetails.service.js`
- `backend/src/services/music/queryNormalize.js`
- `backend/src/services/music/providerCapabilities.js`
- `backend/src/services/music/providerRegistry.js`
- `backend/package.json`
- `backend/.env.sample`

---

## 10. New dependencies

**Production app:** none.  
**Isolated eval only:** `node-youtube-music` under `_provider_eval/multi/` (not added to backend/frontend package.json).

---

## 11. Environment variables

Existing: `SAYA_*`, `JIOSAAVN_*`, `JIOSAAVN_AUTHORIZED`, Clerk, Cloudinary, CORS.

Optional new (documented in `.env.sample`):
- `SEARCH_PROVIDER_TIMEOUT_MS`
- `SEARCH_QUERY_CACHE_TTL_MS`
- `ITUNES_TIMEOUT_MS`
- `MUSICBRAINZ_USER_AGENT`

---

## 12. Test / build results

| Suite | Result |
| --- | --- |
| Backend `npm test` | **43/43 pass** |
| Frontend `vitest` | **4/4 pass** |
| Frontend production build | **success** |
| Deploy | **not done** |

---

## 13. Remaining limitations

1. JioSaavn sidecar still required for authorized Hindi full tracks / Jio playlists.
2. Apple results are preview-first; not full songs.
3. MusicBrainz albums often lack artwork until CAA enrichment (strong-match only).
4. YouTube Music catalogue not available until a reliable official/embed-safe path exists.
5. Gaana not integrated; would need legal + self-host review even for metadata.
6. Audius remains useful for open-platform music but is demoted on Bollywood artist-intent queries.

---

## 14. Manual testing

1. Search `Shreya Ghoshal` → many songs with her credit; artist card present; albums are hers.
2. Search `Shreya Ghoshal albums` → album intent; Shreya-credited albums.
3. Search `Arjit Singh` → Arijit results.
4. Search `Kesariya` / `Tum Hi Ho` → relevant title matches ranked first.
5. Open Apple artist page → songs + albums load.
6. Stop Jio sidecar → search still returns Apple (+ Audius filtered) results.
7. Confirm Deezer never appears; mini-player / library still work.

---

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| More relevant songs for artist searches | Met (live tests) |
| Correct artist discographies (Apple lookup) | Met |
| Correct album search / tracklists | Met (Apple + filters; Jio when up) |
| Unique coverage without unauthorized streams | Met |
| No unrelated results dominating | Improved / Met for Shreya suite |
| Duplicate recordings controlled | Met (existing dedupe) |
| Provider failure isolation | Met |
| Honest playback labels | Met |
| Player/library preserved | Met |
| Deezer blocked | Met |
| Tests & builds pass | Met |
