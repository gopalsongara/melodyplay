# MelodyPlay — Deezer Removal & Spotify-Inspired Mobile UI

**Date:** 2026-11-04  
**Scope:** Remove Deezer from active discovery/playback; polish mobile UX; preserve architecture, other providers, desktop layout, and existing data.  
**Deploy:** Not performed (per requirements).

---

## 1. Deezer removal summary

Deezer is fully removed from MelodyPlay’s **active** provider ecosystem.

| Surface | Change |
| --- | --- |
| Provider registry | `BLOCKED_PROVIDERS` includes `deezer`; `parseProviderList` / `filterAllowedEntities` strip it even if a client requests it |
| Capabilities | Deezer no longer listed; `getProviderCapability("deezer")` returns `authorizationStatus: "removed"` |
| Search | Defaults `jiosaavn,audius,apple` — no Deezer API calls |
| Charts / trending / home | Built from JioSaavn + Audius only |
| Genre / mood tracks | JioSaavn + Audius search (no Deezer radio/search) |
| Stream / preview | Deezer returns **HTTP 410** — no 30s preview fallback |
| Full-track upgrade | No longer upgrades “from Deezer”; Apple preview → Jio/Audius path retained |
| Routes | `/music/deezer-radios` and `/:id` removed |
| Podcasts | Catalog endpoints return empty / 410 (previously Deezer-only via Saya) |
| Frontend | No Deezer labels, radio fetch, or default `provider=deezer` routes |

Legacy mappers (`mapDeezerTrack`, `mapDeezerRadio`) remain in `music.mapper.js` as unused helpers so unrelated mapping code is not rewritten; they are not called by active services.

**Checkpoint:** `stash@{0}: checkpoint-deezer-removal-mobile-ui-20261104` (created before code changes).

---

## 2. Files changed (primary)

### Backend
- `src/services/music/providerRegistry.js` *(new)*
- `src/services/music/providerCapabilities.js`
- `src/services/music/musicSearch.service.js`
- `src/services/music/musicDiscovery.service.js`
- `src/services/music/musicStream.service.js`
- `src/services/music/musicDetails.service.js`
- `src/services/music/musicRadio.service.js`
- `src/controllers/music.controller.js`
- `src/routes/music.route.js`
- `src/app.js`, `src/index.js` (provider messaging)
- `tests/deezerRemoval.test.js` *(new)*
- `tests/providerCapabilities.test.js`
- `tests/health.and.auth.test.js`
- `package.json` (test script includes deezer removal suite)

### Frontend
- `src/pages/home/HomePage.tsx` — mobile greeting, quick-access grid, profile entry, Deezer shelves removed
- `src/components/MobileNav.tsx` — active state + “Your Library” label
- `src/layout/components/PlaybackControls.tsx` — mini-player progress bar / touch target polish
- `src/pages/radio/RadioPage.tsx` — Radio Browser only
- `src/pages/explore/ExplorePage.tsx` — podcasts tile replaced with moods (Deezer podcasts gone)
- `src/pages/ext/External{Album,Artist,Playlist}Page.tsx` — defaults → `jiosaavn`
- `src/pages/podcasts/PodcastDetailPage.tsx` — external link copy
- `src/stores/useExternalMusicStore.ts` — removed `fetchDeezerRadio`
- `src/stores/usePlayerStore.ts` — no Deezer stream/upgrade branches
- `src/lib/playbackDisplay.test.ts`

### Report
- `MELODYPLAY_DEEZER_REMOVAL_MOBILE_UI_REPORT.md` *(this file)*

---

## 3. Provider integrations preserved

| Provider | Discovery | Playback notes |
| --- | --- | --- |
| **Audius** | Search, trending, related, charts fallback | Full stream via Saya `/v1/media/stream` |
| **JioSaavn** | Search, trending, albums/artists/playlists, home shelves | Full when sidecar reachable; production still gated by `JIOSAAVN_AUTHORIZED` |
| **Apple** | Track search (optional) | Preview (~30s); upgrade to Jio/Audius when match exists |
| **Radio Browser** | Stations / tags / countries | Live streams |
| **Archive** | Capability retained | Via Saya media/stream when available |

No new providers were invented. Metadata ≠ full playback remains enforced via `isPreview`, duration honesty, and capability flags.

---

## 4. Search and discovery verification

| Check | Result |
| --- | --- |
| Default track providers exclude Deezer | Pass (`DEFAULT_TRACK_PROVIDERS`) |
| Explicit `providers=...,deezer,...` stripped | Pass (`parseProviderList`) |
| Home/trending/charts do not call `/v1/deezer/*` | Pass (code path review) |
| Entity filter removes Deezer items | Pass (`filterAllowedEntities`) |
| Health capabilities omit Deezer | Pass (smoke + HTTP test) |

Live end-to-end search against Saya/JioSaavn was **not** re-run in this session beyond automated unit/HTTP tests; network-dependent catalog fullness depends on sidecar/Saya availability at runtime.

---

## 5. Playback test results

| Check | Result | Evidence |
| --- | --- | --- |
| Deezer stream rejected (410) | Pass | `tests/deezerRemoval.test.js` |
| Deezer preview rejected (410) | Pass | same |
| Audius upgrade path still wired | Pass | `tests/upgradeFallback.test.js` |
| JioSaavn attestation gate in production | Pass | `providerCapabilities` tests |
| Preview duration honesty | Pass | `playbackHonesty` + frontend `playbackDisplay` |
| Queue / route-change audio continuity | Preserved by design (`AudioPlayer` + Zustand) | Not re-validated on a physical device in this session |
| Real Audius full-URL play on device | **Not claimed** | Requires manual/network session |

---

## 6. Mobile UI changes

- **Home:** Time-based greeting, MelodyPlay brand cue on mobile, profile/settings affordance, 2-column quick-access grid, shelves for recent / artists / albums / mixes / charts / moods.
- **Bottom nav:** Fixed Home · Search · Explore · Your Library with safe-area padding and clearer active state.
- **Mini player:** Above bottom nav (footer `pb` accounts for nav + safe area); artwork, title/artist truncate, play/pause, progress indicator + seek.
- **Expanded player:** Existing `MobileNowPlaying` retained (artwork, seek, shuffle/repeat, queue, favorite, Preview/Full label).
- **Search / Explore / Library:** Existing routes preserved; Explore no longer pushes Deezer podcasts as a primary tile.
- **Desktop:** Resizable sidebar layout unchanged; mobile-only chrome gated with `md:` breakpoints.

---

## 7. Responsive viewport results

| Viewport | Automated CSS/layout review | Real-device / browser resize |
| --- | --- | --- |
| 320×568 … 430×932 | Layout uses fluid grids, `min-w-0`, `overflow-x-hidden`, safe-area padding | **Not executed as interactive viewport lab in this session** |
| 1366×768 / 1440×900 | Desktop path uses prior MainLayout panels | **Not interactively re-screenshot in this session** |

Do **not** treat this as device QA. Manual checklist is in §11.

---

## 8. Backend and frontend test results

### Backend (`npm test`)
```
tests 22 | pass 22 | fail 0
```
Suites include: Deezer removal, providerCapabilities/registry, playbackHonesty, rateLimit, library isolation, health+auth, upgradeFallback.

### Frontend (`npm test`)
```
playbackDisplay.test.ts — 4 passed
```

---

## 9. Production build result

```
frontend: tsc -b && vite build → success (dist emitted)
```

Backend health smoke (`createApp` → `GET /api/health`):
```json
{
  "status": 200,
  "ok": "ok",
  "caps": ["apple", "audius", "jiosaavn", "radio-browser", "archive"]
}
```

---

## 10. Remaining limitations

1. **Podcast catalog** has no replacement provider after Deezer removal (empty search / 410 detail).
2. **Deezer-curated radios** removed; only Radio Browser stations remain.
3. **Album/artist/playlist detail** pages for non-JioSaavn providers may still return 501 where only Jio detail APIs are implemented.
4. **JioSaavn** full playback in production still requires operator attestation (`JIOSAAVN_AUTHORIZED=true`) and a reachable sidecar.
5. **Apple** remains preview-first unless an authorized full sibling upgrade succeeds.
6. Mapper helpers for Deezer still exist as dead code (not wired).
7. No real-device or interactive multi-viewport browser suite was run in this pass.

---

## 11. Manual mobile testing instructions

1. Start backend + frontend (and JioSaavn sidecar if testing full Hindi catalog).
2. Open DevTools device mode (or a phone on LAN) at **390×844** and **360×800**.
3. Confirm bottom nav does not cover mini-player; expand/collapse Now Playing without stopping audio when switching Home → Search.
4. Search a known Audius-friendly query; play a track; confirm label **Full** (or honest Preview for Apple if shown) and duration matches actual audio.
5. Confirm search/home never show provider badge or rows from Deezer.
6. Open Explore → Radio; play a Radio Browser station.
7. Switch routes while playing; audio must continue.
8. Repeat on desktop width ≥1366: sidebar + desktop player visible; mobile nav hidden.
9. Optional: set `JIOSAAVN_AUTHORIZED=false` in production-like `NODE_ENV` and confirm upgrade attempts stay gated.

---

## Acceptance criteria checklist

| Criterion | Status |
| --- | --- |
| Deezer removed from active discovery & playback | Met |
| No Deezer preview results shown | Met (APIs + FE paths) |
| Existing providers remain functional (code + capability tests) | Met; live Jio depends on sidecar |
| Audius playback path intact | Met (wiring + upgrade test) |
| Authorization / DRM restrictions intact | Met |
| Mobile UI Spotify-inspired polish | Met (pattern-level; not asset-copy) |
| Bottom nav / mini / expanded player | Met |
| Search, Explore, Library | Met (podcasts limited) |
| Desktop intact | Met by layout preservation |
| Data preserved | Met (no migrations / wipes) |
| Tests pass | Met (22 BE + 4 FE) |
| Production build succeeds | Met |
| Deploy | Not done (intentional) |
