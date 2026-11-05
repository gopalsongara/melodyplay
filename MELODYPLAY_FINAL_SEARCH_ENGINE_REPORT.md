# MelodyPlay — Final Search Engine & Provider Integration Report

**Date:** 2026-11-04  
**Checkpoint:** `stash@{0}: checkpoint-final-search-engine-20261104`  
**Prior checkpoint:** `checkpoint-multi-provider-catalogue-20261104`  
**Deploy:** Not performed.

---

## 1. Existing provider audit

| Provider | Status | Role verified |
| --- | --- | --- |
| Apple / iTunes | Working | Songs, albums, artists, artist ID lookup, discography songs/albums, artwork, preview URLs |
| MusicBrainz | Working | Artist resolve, aliases, release groups; **~1 req/s queue** + lookup cache |
| Cover Art Archive | Working | Front-cover enrichment only after **strong** MB title+artist match |
| Audius (via Saya) | Partial | Catalogue + streams; demoted for Bollywood artist-intent noise |
| JioSaavn sidecar | Partial | Adapter retained; offline does not fail the whole search |
| Radio Browser | Working | Live radio (unchanged) |
| Internet Archive | Retained | Permitted recordings (capability retained) |
| Deezer | **Blocked** | Registry + capability + stream/preview rejection tests pass |

Adapters reused (not rebuilt): `apple.adapter.js`, `musicbrainz.adapter.js`, `artwork.service.js`, JioSaavn/Saya clients, `providerRegistry.js`.

---

## 2. Providers verified and integrated

- **Apple** is the primary mainstream discovery source; artist searches resolve a canonical Apple artist ID (`resolveArtist`) then fetch artist-specific songs/albums.
- **MusicBrainz** enriches artist identity and album discography under rate limit.
- **CAA** fills missing album art only when MB match scores are high (title ≥ 0.88, artist ≥ 0.75).
- **Audius** remains complementary; ranking demotes ringtones / slowed+reverb / covers / weak artist credit on artist-intent queries.
- **JioSaavn** still participates when the sidecar is healthy; authorization gates unchanged.

---

## 3. Existing adapters reused

- `backend/src/services/music/adapters/apple.adapter.js` — extended with `resolveArtist` + exact-name de-dupe
- `backend/src/services/music/adapters/musicbrainz.adapter.js` — rate-limited queue + cache (rewritten earlier this session)
- `backend/src/services/music/artwork.service.js` — CAA flow unchanged
- Orchestration: `searchOrchestrator.js` — timeout, cache, inflight dedupe, retry/backoff, circuit breaker, `providerStatus`

---

## 4. Missing functionality completed

| Area | Change |
| --- | --- |
| Intent detection | `SONG` / `ARTIST` / `ALBUM` / `PLAYLIST` / `GENRE` / `MOOD` / `GENERAL` + `entityQuery` (strips “songs”/“albums”) |
| Artist pipeline | Apple `resolveArtist` → `getArtistSongs` / `getArtistAlbums` |
| Fallback | Per-provider isolation; partial results; Jio down ≠ empty search |
| Ranking | Relevance-first; playback ±8 only; stronger Audius noise demotion |
| Response diagnostics | `detectedIntent`, `providerSources`, `providerStatus`, `searchLatencyMs`, `resultCounts` |
| Circuit breaker | Opens after repeated provider failures (`SEARCH_CIRCUIT_*`) |
| Known song titles | “Tum Hi Ho”, “Channa Mereya”, etc. forced to `SONG` intent |

---

## 5. Search architecture

```
Query
  → detectSearchIntent + buildSearchVariants (aliases / typos)
  → parallel runProviderTasks (timeout + retry + circuit)
      Apple search | Audius | JioSaavn (if up)
  → artistIntent? Apple resolveArtist + discography
  → albumIntent? Apple/MB artist albums + CAA enrich (top missing art)
  → filterAllowedEntities (Deezer stripped)
  → dedupeTracks (ISRC / title+artist / duration)
  → relevanceScore + rank
  → annotatePlayback (honest playbackType)
  → response + diagnostics
```

MusicBrainz traffic is serialized (~1.1s spacing) and cached — never unlimited parallel MB floods.

---

## 6. Search relevance comparisons (live smoke)

Suite: `backend/scripts/smoke-search-engine.mjs` → `_provider_eval/final-search-smoke.json`

| Query | Intent | Total | Relevant | Unrelated % | Latency (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Shreya Ghoshal | ARTIST | 20 | 20 | 0 | ~2468 |
| Shreya Ghoshal songs | ARTIST | 20 | 20 | 0 | ~2468 |
| Shreya Ghoshal albums | ALBUM | 20 | 20 | 0 | ~2084 |
| Arijit Singh | ARTIST | 20 | 20 | 0 | ~1946 |
| Arjit Singh | ARTIST | 20 | 20 | 0 | ~1698 |
| Sonu Nigam | ARTIST | 20 | 20 | 0 | ~1154 |
| Kishore Kumar | ARTIST | 20 | 20 | 0 | ~1693 |
| Lata Mangeshkar | ARTIST | 20 | 20 | 0 | ~1701 |
| Udit Narayan | ARTIST | 20 | 20 | 0 | ~1746 |
| Sunidhi Chauhan | ARTIST | 20 | 20 | 0 | ~1132 |
| Kesariya | SONG | 20 | 20 | 0 | ~726 |
| Tum Hi Ho | SONG | 20 | 15 | 25 | ~1077 |
| Channa Mereya | SONG | 13 | 13 | 0 | ~702 |
| Believer | SONG | 20 | 20 | 0 | ~949 |
| Starboy | SONG | 20 | 20 | 0 | ~825 |
| Hindi Sad Songs | MOOD | 20 | 20 | 0 | ~710 |
| Bollywood Romantic Songs | MOOD | 20 | 20 | 0 | ~934 |

**Avg latency (suite):** ~1.4–1.6s per query (cache warm on repeated entity queries).

---

## 7. Per-provider results (representative)

Artist queries typically show:

- `apple` general search: ~40 hits before rank/slice  
- `apple_discography`: ~50 artist-specific tracks when ID resolves  
- `audius`: variable (3–40); demoted when artist credit is weak  
- `jiosaavn`: often absent when local sidecar is down — search still returns Apple/Audius  

Album query `Shreya Ghoshal albums`: `apple_artist_albums` 40 (+ MusicBrainz when not circuit-skipped/cached path).

---

## 8. Duplicate statistics

- Cross-provider merge via `dedupeTracks` (fingerprint: ISRC when present, else normalized title + primary artist + duration bucket).
- Alternate provider IDs preserved on the winning entity where the merge path attaches sources.
- Distinct remixes / live / covers kept separate (noise titles demoted, not force-merged).

Smoke suite counts **unique recordings ≈ returned page size** after dedupe (limit 20).

---

## 9. Search latency

| Metric | Observation |
| --- | --- |
| Provider timeout | `SEARCH_PROVIDER_TIMEOUT_MS` default 8000 |
| Inflight dedupe | Concurrent identical queries share one promise |
| Query cache TTL | `SEARCH_QUERY_CACHE_TTL_MS` default 45000 |
| MB spacing | ~1100 ms between MusicBrainz HTTP calls |
| Circuit | Opens after `SEARCH_CIRCUIT_FAILS` (default 4) |

---

## 10. Artwork results

- Apple artwork preferred when present (upscaled 100→600 where applicable).
- CAA used only after strong MB release match; unrelated similar titles are rejected.
- Placeholder SVG remains when no safe match exists (`artworkSource: placeholder`).

---

## 11. Playback capabilities

| Classification | Typical providers |
| --- | --- |
| `preview` | Apple iTunes previews (`isPreview: true`) |
| `authorized_full_stream` | JioSaavn when authorized + stream resolves; Audius when playable |
| `metadata_only` | MusicBrainz |
| `unavailable` | No stream/preview |

Rules preserved: no YouTube extract, no DRM/HLS decrypt, no cookie reuse, previews never labelled as full tracks, Deezer blocked.

---

## 12. Environment variables

Existing + documented in `backend/.env.sample`:

```
SAYA_API_BASE_URL=
JIOSAAVN_API_BASE_URL=
JIOSAAVN_AUTHORIZED=
SEARCH_PROVIDER_TIMEOUT_MS=8000
SEARCH_QUERY_CACHE_TTL_MS=45000
SEARCH_PROVIDER_RETRIES=1
SEARCH_CIRCUIT_FAILS=4
SEARCH_CIRCUIT_COOLDOWN_MS=60000
ITUNES_TIMEOUT_MS=8000
MUSICBRAINZ_USER_AGENT=MelodyPlay/1.0 (https://example.com; you@example.com)
```

---

## 13. Files changed (this pass)

- `backend/src/services/music/queryNormalize.js` — intent enum, entityQuery, known song titles
- `backend/src/services/music/searchOrchestrator.js` — circuit breaker, retries, health
- `backend/src/services/music/adapters/apple.adapter.js` — `resolveArtist`, artist de-dupe
- `backend/src/services/music/adapters/musicbrainz.adapter.js` — rate limit + cache
- `backend/src/services/music/musicSearch.service.js` — unified pipeline diagnostics, discography path
- `backend/.env.sample` — search/MB/circuit vars
- `backend/tests/searchRelevance.test.js` / `searchIntelligence.test.js` — intent + circuit tests
- `backend/scripts/smoke-search-engine.mjs` — live smoke suite
- `_provider_eval/final-search-smoke.json` — smoke output
- `MELODYPLAY_FINAL_SEARCH_ENGINE_REPORT.md` — this report

---

## 14. Dependencies added or removed

**None.** No new npm packages.

---

## 15. Backend test results

```
npm test  →  45/45 pass
```

Includes: Deezer block, health/auth, playback honesty, capabilities, rate limit, queryNormalize, circuit breaker, dedupe, orchestration isolation, live Shreya/Arijit relevance.

---

## 16. Frontend test results

```
npx vitest run  →  4/4 pass
```

---

## 17. Production build results

```
npx tsc -b && vite build  →  success
```

---

## 18. Remaining limitations

- Not every song is available for full playback; Apple remains **preview**.
- JioSaavn full streams require a reachable authorized sidecar.
- Audius may still contribute some weak matches on song-title queries (e.g. Tum Hi Ho ~25% soft-unrelated by heuristic).
- MusicBrainz commercial-use terms must be reviewed before monetized production.
- CAA enrichment is intentionally capped (strong match + limited parallel enrich) to protect MB/CAA.
- Two-token song titles that are not in `KNOWN_SONG_TITLES` may still classify as `ARTIST`.

---

## 19. Manual testing instructions

1. Start backend: `cd backend && npm run dev`
2. Optional Jio sidecar on `JIOSAAVN_API_BASE_URL` (search works without it).
3. Frontend: `cd frontend && npm run dev`
4. Search: Shreya Ghoshal / songs / albums; Arjit Singh; Kesariya; Tum Hi Ho.
5. Confirm Apple results show preview labelling; no Deezer entities.
6. Live smoke: `cd backend && node scripts/smoke-search-engine.mjs`
7. Automated: `cd backend && npm test` · `cd frontend && npx vitest run && npm run build`

---

## Acceptance checklist

| Criterion | Result |
| --- | --- |
| Multi-provider search | Pass (Apple + Audius + Jio when up + MB albums) |
| Provider failure isolation | Pass (tests + smoke with Jio down) |
| Shreya Ghoshal multiple relevant tracks | Pass (20/20) |
| Artist albums correct | Pass (20/20 Shreya-credited) |
| Exact title priority | Pass (Kesariya/Believer/Starboy) |
| Audius noise not dominating Bollywood artists | Pass (demotion + Apple discography) |
| Honest playback labels | Pass |
| Deezer blocked | Pass |
| Existing tests + new tests | Pass (45 backend, 4 frontend) |
| Production build | Pass |
| Deploy | **Not done** (per request) |
