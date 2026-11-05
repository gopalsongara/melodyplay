# MelodyPlay — Intelligent Search & Provider Audit

**Date:** 2026-11-04  
**Checkpoint:** `stash@{0}: checkpoint-search-provider-artwork-20261104`  
**Deploy:** Not performed.

---

## 1. Existing provider audit

| Provider | Role in MelodyPlay | Discovery | Playback | Notes |
| --- | --- | --- | --- | --- |
| **JioSaavn** (local sidecar `localhost:3099`) | Primary full-track Hindi catalog | Songs, albums, artists, playlists | Full when sidecar up + attestation rules | **Down in this session** (`fetch failed`) — failures isolated |
| **Audius** via Saya | Open-platform tracks | Track search / trending | Full via Saya stream | Artwork maps from `artwork[480x480]` etc. |
| **Apple / iTunes** | Metadata + ~30s previews | Songs (Saya + direct iTunes), albums/artists (direct iTunes Search API) | Preview only unless upgraded | Public iTunes Search is authorized metadata |
| **Radio Browser** via Saya | Live radio | Stations | Live streams | Unchanged |
| **Internet Archive** | Capability retained | Via Saya when available | Full when available | Not primary search |
| **Deezer** | **Permanently blocked** | None | 410 | Remains in `BLOCKED_PROVIDERS` |

SayaMusicAPI continues as the aggregation gateway for Audius (and optional Apple song fallback).

---

## 2. GitHub repository evaluation

| Repository | What it is | License | Verdict |
| --- | --- | --- | --- |
| [saavn-labs/sdk](https://github.com/saavn-labs/sdk) | Low-level TypeScript SDK over JioSaavn native API (Zod-validated) | MIT | Useful as an **alternate Jio client**, not a new catalog. **Not installed** into MelodyPlay (evaluation only). |
| [Sandipeyy/NepoTuneAPI](https://github.com/Sandipeyy/NepoTuneAPI) | Unofficial JioSaavn HTTP API (Hono) | MIT | Same upstream as Jio. Public demo returned **HTTP 402**. Not added. |
| [shnwazdev/shnwazdev-jiosaavn-api](https://github.com/shnwazdev/shnwazdev-jiosaavn-api) | Unofficial JioSaavn API (already the intended local sidecar shape) | MIT | Hosted `jio.shnwaz.dev` probe **failed** this session. Keep existing local sidecar integration. |
| [AudiusProject](https://github.com/AudiusProject) | Official Audius org / apps / protocol | Open-source (various) | Already integrated via Saya. No duplicate SDK install. |

**Important:** All JioSaavn wrappers are **the same catalogue**. They do not count as independent music providers.

---

## 3. Repositories / endpoints tested in isolation

Isolated probes under `_provider_eval/` (not installed into app dependencies):

| Probe | Result | Latency (approx.) |
| --- | --- | --- |
| Local JioSaavn `localhost:3099` | Unreachable | — |
| Saya Audius search `Believer` | OK, artwork present | ~4.2s |
| Saya Apple songs `Starboy` / `Believer` | Empty `0` results | ~0.6s |
| iTunes Search albums `Kesariya` | OK + artwork | <1s |
| iTunes Search artists `Arijit Singh` | OK | <1s |
| iTunes songs typo `Arjit Singh` | Returns Arijit-related songs | <1s |
| NepoTune public | HTTP 402 | ~0.5s |
| shnwaz public | fetch failed | — |
| MusicBrainz (with User-Agent) | OK | ~2s |
| Cover Art Archive | Wired optionally behind strong match | — |

Live MelodyPlay smoke (`GET /api/music/search?q=Arjit%20Singh`):

- `searchPrimary`: `arijit singh` (original query preserved as `Arjit Singh`)
- Albums/artists from **Apple** with artwork
- Tracks from **Audius** (full, not preview)
- JioSaavn errors present but **did not break** the response
- Latency ~**3950 ms**
- Deezer absent from health capabilities

---

## 4. Search quality before vs after

| Area | Before | After |
| --- | --- | --- |
| Typos (`Arjit`, `Keseeriya`, `Tumhi Ho`, `Ghosal`) | Exact provider query only | Alias + variant expansion; original preserved |
| Ranking | Substring heuristics | Similarity + playback capability (full > preview) |
| Provider failure | Mostly safe, no shared timeout layer | `runProviderTasks` timeout + partial results + cache/inflight dedupe |
| Albums after Deezer removal | Often empty (Jio-only + sidecar down) | Apple/iTunes album search fills catalog |
| Artists artwork | Often placeholder due to mapper bug | Jio `type:artist` uses `image[]`; Apple artists mapped |

---

## 5. Artwork issue — root cause

1. Deezer previously supplied most rich covers; removal exposed Jio/Audius/Apple gaps.
2. Local Jio sidecar down → no Jio images.
3. **`mapArtist` evaluated `item.type === "artist"` before the JioSaavn branch**, so Jio artists were mapped with Deezer `picture_*` fields → shared Cloudinary placeholder for every artist.
4. Frontend already had `onError` fallbacks; bad upstream URLs were the main bug.

**Fixes:** provider-first mapping order; neutral SVG placeholder (not one Cloudinary cover reused as “fake art”); Apple artwork upscaling; optional MusicBrainz/CAA enrichment only on **strong** title+artist match; MediaCard `key` + one-shot fallback.

---

## 6. Album discovery — root cause

1. Album search was effectively **JioSaavn-only**.
2. With Deezer gone and sidecar down, album arrays were empty.
3. Album detail was Jio-only (501 elsewhere) — correct capability honesty, but no alternate metadata path.

**Fixes:** parallel Jio + **Apple iTunes album search**; Apple album/artist **lookup** detail routes; capability fields (`preview_only` / `itunes_lookup`); empty/error isolation when Jio fails.

---

## 7. New and modified files

### New
- `backend/src/services/music/queryNormalize.js`
- `backend/src/services/music/searchOrchestrator.js`
- `backend/src/services/music/dedupe.js`
- `backend/src/services/music/artwork.service.js`
- `backend/src/services/music/itunes.client.js`
- `backend/tests/searchIntelligence.test.js`
- `_provider_eval/` (isolated probes + `ROOT_CAUSES.md`)
- `MELODYPLAY_SEARCH_AND_PROVIDER_AUDIT.md`

### Modified (primary)
- `backend/src/services/music/musicSearch.service.js`
- `backend/src/services/music/music.mapper.js`
- `backend/src/services/music/musicDetails.service.js`
- `backend/src/services/music/providerRegistry.js`
- `backend/package.json`
- `frontend/src/pages/search/SearchPage.tsx`
- `frontend/src/components/music/MediaCard.tsx`
- `frontend/src/stores/useExternalMusicStore.ts`

---

## 8. Provider success / failure (this session)

| Provider | Search smoke | Failure mode |
| --- | --- | --- |
| Apple/iTunes | Success (albums/artists/songs) | Saya Apple path often empty — mitigated by direct iTunes |
| Audius | Success (tracks + art) | Slow via Saya (~seconds) |
| JioSaavn | Fail | Sidecar unreachable — isolated errors |
| Deezer | Blocked | N/A |
| MusicBrainz/CAA | Available with UA | Used only for missing-art enrichment |

---

## 9. Search latency

| Call | Observed |
| --- | --- |
| Universal search `Arjit Singh` | ~3.9s (Audius + iTunes; Jio timeout/fail parallel) |
| Provider timeout default | 8000 ms (`SEARCH_PROVIDER_TIMEOUT_MS`) |
| Query cache TTL | 45s (`SEARCH_QUERY_CACHE_TTL_MS`) |

---

## 10. Playback limitations (unchanged honesty)

- Apple = preview unless upgrade finds authorized full sibling.
- Audius = full when stream resolves.
- JioSaavn = full only when sidecar reachable and attestation allows attempts in production.
- Never treat metadata as full playback.
- Deezer never used as preview fallback.

---

## 11. Test results

### Backend
```
tests 37 | pass 37 | fail 0
```
Includes Deezer removal, capabilities, orchestration timeout/isolation, typo normalization, dedupe, artwork mapping regressions.

### Frontend
```
playbackDisplay.test.ts — 4 passed
tsc -b && vite build — success
```

### Health
`GET /api/health` → `ok`; capabilities: apple, audius, jiosaavn, radio-browser, archive (no deezer).

---

## 12. Remaining issues

1. **JioSaavn sidecar must be running** for Hindi full tracks and Jio playlists; Apple/Audius cannot fully replace that catalog.
2. Artist search on Apple may return duplicate `Arijit Singh` rows (multiple iTunes artist IDs) — soft-deduped by id, not by name.
3. MusicBrainz/CAA enrichment is rate-limited and skipped unless art is missing and match is strong.
4. Transliteration is alias-based (practical Hindi names), not a full transliteration engine.
5. No real-device UI lab in this pass; FE search skeletons/top-result added in code.
6. Candidate GitHub Jio wrappers **not** promoted to production dependencies.

---

## 13. Manual testing instructions

### Desktop
1. Start backend, frontend, and Jio sidecar (optional but recommended).
2. Search: `Arjit Singh`, `Keseeriya`, `Tumhi Ho`, `Shreya Ghosal`, `Believer`, `Hindi sad songs`.
3. Confirm Top result + Songs / Artists / Albums / Playlists sections.
4. Confirm album cards show distinct artwork (not one shared cover).
5. Open an Apple album → detail loads tracks as previews; Jio album → full when sidecar up.
6. Stop Jio sidecar → search still returns Apple/Audius results.

### Mobile
1. 390×844 device mode: search input, suggestions, horizontal shelves, artwork fallbacks.
2. Play a track; navigate away; mini-player persists.
3. Confirm Deezer never appears in labels/results.

---

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| Deezer completely removed | Met |
| Partial / misspelled queries relevant | Met (aliases + ranking; live smoke on `Arjit Singh`) |
| Artist searches return profiles + related tracks | Met (Apple artists; related via seed artist tracks) |
| Albums with artwork | Met when Apple/iTunes reachable |
| Playlists | Met when Jio up; empty isolated when down |
| Song images reliable | Improved (mapper fix + fallbacks) |
| Duplicate control | Met (title+artist+duration-compatible; full > preview) |
| Independent providers / failure isolation | Met |
| Honest preview/full | Met |
| Player/library intact | Preserved |
| Tests + production build | Pass |
| Deploy | Not done |
