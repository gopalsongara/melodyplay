# MelodyPlay — Mobile Playback & UI Fix Report

**Date:** 2026-11-03 / 2026-11-04  
**Checkpoint:** `git stash@{0}` → `checkpoint-mobile-playback-ui-20261103-2355`  
**Deployed:** No

---

## 1. Root cause of mobile ~30s playback

**Not a separate mobile API bug.** Laptop and phone hit the same LAN backend (`hostname:8080`) and the same `resolveStreamIfNeeded` / `upgrade-full` / `/music/stream` pipeline.

Evidence while JioSaavn sidecar was **unreachable** (`localhost:3099`):

| Context | Typical content | Result |
|---------|-----------------|--------|
| Home featured (laptop often taps) | **Audius**, `isPreview: false`, duration 150–400s | Full playback |
| Search “Tum Hi Ho” (mobile Bollywood) | Mix of Audius full + **Deezer** `isPreview: true` | Deezer stream = **30s preview** CDN |
| `POST /upgrade-full` (Deezer → full) | JioSaavn down; artist-safe Audius match often absent for official Bollywood | Upgrade `false` → honest preview |
| `GET /stream?source=deezer&id=…` | `isPreview: true`, `duration: 30`, host `cdnt-preview.dzcdn.net` | Confirmed preview |

So mobile felt “broken” because users pick Deezer Bollywood rows; laptop felt “fine” because Home featured Audius full tracks. Same provider rules on both devices.

---

## 2. Why laptop differed

1. **Home shelf** falls back to Audius full tracks when JioSaavn is down.  
2. **Search** surfaces Deezer catalog metadata with preview-only streams.  
3. JioSaavn full upgrade cannot run without the sidecar (and must not be force-enabled without authorization).  
4. No mobile-only code path was selecting previews.

---

## 3. Files modified

### Playback / providers
- `backend/src/services/music/musicStream.service.js` — Audius full-track upgrade fallback + artist-aware matching  
- `frontend/src/stores/usePlayerStore.ts` — diagnostics, upgrade status  
- `frontend/src/components/AudioPlayer.tsx` — `playsInline`, src clear on change, safer error handling  
- `frontend/src/lib/playbackDisplay.ts` (+ tests) — `preferFullSibling`  

### Mobile UI
- `frontend/src/components/MobileNav.tsx` — Home / Search / Explore / Library  
- `frontend/src/pages/explore/ExplorePage.tsx` — new Explore hub  
- `frontend/src/components/MobileNowPlaying.tsx` — full-screen mobile player + diagnostics  
- `frontend/src/layout/components/PlaybackControls.tsx` — mobile mini-player  
- `frontend/src/layout/MainLayout.tsx` — wire expanded player  
- `frontend/src/App.tsx` — `/explore` route  
- `backend/tests/upgradeFallback.test.js` — wiring test  

---

## 4. Exact changes made

1. **Audius upgrade path** after JioSaavn fails/disallowed (authorized open platform via Saya) — only when **artist overlaps** (prevents fingerstyle cover traps).  
2. **Search play preference:** tapping a Preview row prefers a same-title **Full** sibling in the result list when present.  
3. **Honest preview** remains if no authorized full match exists.  
4. **Mobile mini-player** above bottom nav; **expandable now-playing** with seek/shuffle/repeat/queue/favorite + safe diagnostics.  
5. **Explore** tab + safe-area padding so content isn’t hidden behind nav.  
6. **playsInline** + clear `audio.src` on track/source change so upgrades don’t leave a stale preview URL.

---

## 5. Provider-specific limitations

| Provider | Mobile expectation |
|----------|--------------------|
| Audius | Full tracks when selected / upgraded with artist match |
| Deezer / Apple | Preview-only unless upgraded |
| JioSaavn | Full only if sidecar reachable **and** (prod) `JIOSAAVN_AUTHORIZED=true` — **currently unavailable** |

**Do not claim official Bollywood full tracks are fixed** while JioSaavn is down and unauthorized for production.

---

## 6. Playback test results

| Test | Result |
|------|--------|
| Home featured Audius full | Available (API) |
| Deezer stream honesty `duration: 30` | **PASS** |
| Upgrade without artist match (cover) | Rejected (**PASS**) |
| Upgrade when no safe Audius match | `upgraded: false` → preview (**PASS**) |
| Prefer full sibling in search list | Unit tested (**PASS**) |
| Real-device mobile browser E2E | **NOT TESTED** (use manual steps below) |

---

## 7. Mobile UI improvements

- Bottom nav: Home, Search, Explore, Library (44px targets, safe-area)  
- Mini-player + expandable full player  
- Explore hub (charts/radio/podcasts/genres)  
- Preview/Full labels + diagnostics panel in expanded player  
- Desktop player layout preserved (`md:` breakpoints)

---

## 8. Responsive viewport notes

Automated real-device matrix not run. Layout uses:

- `md:` split for mobile vs desktop  
- `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` under mini-player  
- Horizontal shelves: `overflow-x-auto` + hidden scrollbars  
- Grids: `grid-cols-2` on Explore  

**Claim:** structural mobile-first CSS applied; **manual** check on 320–430 widths recommended.

---

## 9. Backend / frontend tests

| Suite | Result |
|-------|--------|
| Backend `npm test` | **13/13 PASS** |
| Frontend `npm test` | **4/4 PASS** (after preferFullSibling) |
| Frontend `npm run build` | **PASS** |
| `/api/health` | Backend running on `0.0.0.0:8080` |

---

## 10. Remaining issues

1. Official Bollywood **full** tracks still need JioSaavn sidecar (authorized) or another licensed full source.  
2. Audius upgrades only when artist-safe match exists — many Deezer hits stay Preview.  
3. Clerk LAN allowlist still manual.  
4. Real phone E2E not executed in this session.  
5. npm audit transitive vulns unchanged (not force-upgraded).

---

## 11. Required environment variables

```env
# Backend (LAN)
PORT=8080
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://10.252.52.85:3000
JIOSAAVN_API_BASE_URL=http://localhost:3099   # must be RUNNING for Jio full tracks
# JIOSAAVN_AUTHORIZED=true   # production only after legal attestation

# Frontend — usually auto via window.location.hostname
# VITE_API_BASE_URL=http://10.252.52.85:8080/api
```

---

## 12. Manual mobile testing instructions

1. Start backend (`npm start` in `backend`) and Vite (`npm run dev` in `frontend`).  
2. Optionally start JioSaavn on `:3099` for full Bollywood upgrades.  
3. On phone Wi-Fi: open `http://<LAN-IP>:3000` (hard refresh).  
4. Play a **Home** featured track → expect **Full** (often Audius).  
5. Search a Hindi hit → prefer rows labeled **Full**; Preview rows should say **Preview** and duration ~0:30.  
6. Tap Preview when a Full sibling exists → should jump to Full.  
7. Open mini-player → expand → confirm seek, next/prev, diagnostics (provider / upgrade / host).  
8. Confirm bottom nav: Home / Search / Explore / Library; no content trapped under the bar.

---

## Acceptance summary

| Criterion | Status |
|-----------|--------|
| Mobile UI loads / nav | **PASS** (code) |
| Same API logic laptop/mobile | **PASS** |
| Full when authorized full source available | **PASS** (Audius / sibling / Jio if up) |
| Preview honestly labeled | **PASS** |
| Player / queue / library preserved | **PASS** |
| Desktop intact | **PASS** (`md:` layouts) |
| Tests + production build | **PASS** |
| Official Bollywood full without Jio | **BLOCKED** — documented |

**Final note:** The 30s mobile issue was primarily **provider content selection + missing JioSaavn**, not LAN CORS. Fixes improve parity and honesty; they do not invent unauthorized full Bollywood streams.
