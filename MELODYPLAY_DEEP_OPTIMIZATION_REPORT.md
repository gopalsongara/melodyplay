# MelodyPlay — Deep Optimization Report

**Date:** 2026-11-04  
**Checkpoint:** `stash@{0}: checkpoint-deep-optimization-20261104`  
**Prior baseline:** `checkpoint-final-search-engine-20261104`  
**Deploy:** Not performed.

---

## 1. Initial bugs found (verified before fixes)

| Bug | Evidence |
| --- | --- |
| Qaafirana ranked wrong artists first | Live API returned Adeel Iftikhar / Arijit Anand above Arijit Singh |
| Songs.PK in player / related queue | Audius search hit `[Songs.PK] 13 - Yo Yo Hits…` (id `KdlRl`); auto-queue related used Audius artist search |
| 502-style playback failures | Saya upstream failures mapped to HTTP 502; axios showed generic “Request failed with status code 502” |
| Deezer still playable from stale state | Registry blocked new Deezer calls, but persisted `recentlyPlayed` / cached `audioUrl` on `dzcdn.net` could bypass stream gate |
| Album page weak UX | Functional Apple/Jio tracklists existed; UI lacked hero, shuffle, duration honesty |

Screenshots (baseline / after): `_provider_eval/screenshots/`.

---

## 2. Deezer leakage root cause

1. **Provider registry already blocked Deezer** for search/stream (410) — that layer was correct.
2. **Leak path:** Zustand `player-storage` persists `recentlyPlayed`. Tracks with `provider: "deezer"` or Deezer CDN URLs could still enter `resolveStreamIfNeeded` when `audioUrl` was already set (early return skipped `/music/stream`).
3. **Library history/favorites** could still store Deezer snapshots from older sessions.

**Fix:** `legacyTrackPolicy` (backend + frontend) sanitizes restore, rejects Deezer CDN URLs, filters discovery, marks library rows non-playable without deleting user data.

---

## 3. Songs.PK / 502 root cause

| Finding | Detail |
| --- | --- |
| Source | **Not a MelodyPlay provider.** Audius user uploads titled `[Songs.PK] …` entered via related/search |
| Playback | Stream for `audius:KdlRl` previously returned 200 from Saya; failures on archive/other IDs surfaced as **502** via `SayaApiError` |
| User impact | Auto-extend queue after play pulled noisy Audius “related” including Songs.PK rips |

**Fix:** Title/artist pattern filter; Audius metadata pre-check on stream → **403** with clear message; related/search use `filterDiscoverableEntities`; player surfaces API message instead of bare axios 502 text.

---

## 4. Spotify UX research findings

See `GITHUB_PROVIDER_AND_UI_RESEARCH.md`.

Applied: Top result card, category filter chips, artist hero, album hero + Play/Shuffle + honest preview duration, horizontal shelves.

---

## 5. GitHub repositories evaluated

| Repo | Verdict |
| --- | --- |
| Tevify / JonniTech Spotify-Clone | UI ideas only (no license listed; Jamendo CC) |
| pulkitdotio/spotify-clone | Tutorial architecture only |
| francoborrelli/spotify-react-web-client | MIT UI ideas; Spotify API not used as MelodyPlay catalogue |
| Beatbump | Archived, AGPL, YT Music — reject playback |
| ytmusicapi | Active MIT — reject unauthorized streams |
| node-youtube-music | Reject unauthorized streams |

---

## 6–8. APIs tested / integrated / rejected

**Retained & live-tested:** Apple/iTunes, MusicBrainz, Cover Art Archive, Audius (Saya), Radio Browser, Archive (cautious), JioSaavn (offline locally).

**Rejected:** Deezer (blocked), Songs.PK-labelled uploads, YT Music scrapers, Spotify commercial catalogue, Gaana wrappers.

---

## 9. Search engine improvements

- Official-artist boost for known titles (`qaafirana` → Arijit Singh / Nikhita Gandhi)
- Version labels (original / female / instrumental / alt) + near-duplicate collapse
- Songs.PK / low-quality upload demotion & filter
- Discoverable entity filter on search + discovery + recommended

**Live result (post-fix):**  
`Qaafirana` top = **Qaafirana — Arijit Singh & Nikhita Gandhi** (deezer=0, songspk=0)

---

## 10. Album and artist page improvements

- Album: hero artwork gradient, year, track count, total duration, Play/Shuffle, preview honesty banner, real Apple/Jio tracklists only
- Artist: large hero, Popular, Albums shelf, Singles & EPs

Verified: `/ext/albums/apple/1652024923` shows real 1-track list with **0:30** preview duration.

---

## 11. Player improvements

- Blocked-provider / Songs.PK guard before stream resolve
- Sanitize persisted recentlyPlayed / queue on merge
- Clearer toast messages for 403/410/502
- Related-queue strips untrusted tracks

---

## 12. Browser screenshots

| File | Content |
| --- | --- |
| `_provider_eval/screenshots/home-desktop.png` | Home greeting / shelves |
| `_provider_eval/screenshots/search-qaafirana-desktop.png` | Qaafirana Top result + filters |
| `_provider_eval/screenshots/album-qaafirana-desktop.png` | Album hero + preview honesty |
| `_provider_eval/screenshots/home-mobile-390.png` | Mobile 390×844 home |

---

## 13–14. Desktop / Mobile QA

| Check | Desktop 1440-class | Mobile 390×844 |
| --- | --- | --- |
| Home | Pass | Pass |
| Search Qaafirana | Pass (Top = Arijit) | Layout OK via responsive CSS |
| Album page | Pass | Not separately re-shot; responsive hero present |
| Deezer in UI | Not observed | — |
| Songs.PK in search | Not observed | — |
| Player navigation survive | Controls persist across routes | Mini-player / bottom nav preserved |

---

## 15–18. Test / build results

| Suite | Result |
| --- | --- |
| Backend `npm test` | **51/51 pass** (includes new `legacyTrackPolicy.test.js`) |
| Frontend `vitest` | **4/4 pass** |
| Frontend production build | **Success** (`tsc -b && vite build`) |
| Live search smoke | Qaafirana, Shreya, Arijit, Kesariya, Tum Hi Ho, Believer, Starboy — all deezer=0, songspk=0, relevant tops |

---

## 19. Remaining issues

1. **JioSaavn sidecar offline** locally → many Bollywood plays remain Apple **previews** unless Audius upgrade matches.
2. Cover/collision artists (Adeel Iftikhar, etc.) still appear **below** the official cut — not removed entirely (genuine Apple catalogue entries).
3. Autoplay click in automated browser sometimes blocked by overlays; manual play confirmed via API stream honesty.
4. Podcast catalogue still empty after Deezer removal (unchanged).
5. Hard-refresh users with ancient Deezer rows in Mongo history keep the rows marked non-playable — clear player localStorage if a ghost track still appears: DevTools → Application → Local Storage → remove `player-storage`.

---

## 20. Files changed (primary)

### Backend
- `src/services/music/legacyTrackPolicy.js` *(new)*
- `src/services/music/providerRegistry.js`
- `src/services/music/queryNormalize.js`
- `src/services/music/musicSearch.service.js`
- `src/services/music/musicStream.service.js`
- `src/services/music/musicDiscovery.service.js`
- `src/controllers/library.controller.js`
- `tests/legacyTrackPolicy.test.js` *(new)*
- `package.json` (test script)

### Frontend
- `src/lib/legacyTrackPolicy.ts` *(new)*
- `src/stores/usePlayerStore.ts`
- `src/pages/search/SearchPage.tsx`
- `src/pages/ext/ExternalAlbumPage.tsx`
- `src/pages/ext/ExternalArtistPage.tsx`
- `src/stores/useExternalMusicStore.ts`

### Docs
- `GITHUB_PROVIDER_AND_UI_RESEARCH.md`
- `MELODYPLAY_DEEP_OPTIMIZATION_REPORT.md`

---

## 21. Dependencies changed

None (no new npm packages).

---

## 22. Manual test instructions

1. Start backend (`cd backend && npm start`) and frontend (`cd frontend && npm run dev`).
2. Hard refresh the browser (Ctrl+Shift+R). Optional: clear `player-storage` if old Deezer ghosts appear.
3. Search **Qaafirana** → Top result should be Arijit Singh & Nikhita Gandhi; filters All/Songs/Albums work.
4. Open an album from results → real tracklist + preview honesty if Apple.
5. Confirm stream rejection:  
   `GET /api/music/stream?source=deezer&id=1` → 410  
   `GET /api/music/stream?source=audius&id=KdlRl` → 403 Songs.PK message
6. Search Shreya Ghoshal / Arijit Singh → artist-relevant songs, no Deezer badges.
7. Resize to ~390px width → home greeting, shelves, bottom nav intact.
8. With JioSaavn off, search still returns Apple/Audius partial results.

---

## Acceptance checklist

| Criterion | Status |
| --- | --- |
| Deezer never in search/capabilities/stream | Met |
| Songs.PK explained + blocked from playback advertising | Met |
| No advertised playable source intentionally left as opaque 502 | Improved (clear messages) |
| Relevant search + official Qaafirana first | Met |
| Real album tracklists | Met (Apple/Jio) |
| Preview vs full honesty | Met |
| Search works with JioSaavn down | Met |
| Mobile UI works | Met |
| Library/auth preserved | Met (no data wipe) |
| Tests + build | Met |
