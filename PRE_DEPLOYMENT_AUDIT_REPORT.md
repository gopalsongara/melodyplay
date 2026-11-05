# MelodyPlay — Pre-Deployment Audit Report

**Date:** 2026-11-03  
**Branch:** `master` (ahead of clean origin with large uncommitted music/LAN work)  
**Checkpoint:** `git stash@{0}` → `checkpoint-pre-deployment-audit-20261103-2259`  
**Deployment:** Not performed (per instructions)

---

## 1. Executive Summary

| Area | Status |
|------|--------|
| Local vs LAN API connectivity / CORS | **PASS** |
| 29–30s playback root cause identified | **PASS** (diagnosed) |
| Full-length Bollywood playback (JioSaavn) | **FAIL** — sidecar down |
| Preview honesty (UI + API) | **PASS** (fixed this audit) |
| Feature parity (same build on LAN) | **PASS** (same code; auth/provider gaps feel like “missing”) |
| Automated test suite | **NOT TESTED** / none exist (`npm test` exits 1) |
| Frontend production build | **PASS** |
| Vercel readiness | **WARNING** — needs prod env + Clerk |
| Render readiness | **WARNING** — needs public JioSaavn URL + CORS + secrets |
| Overall deploy readiness | **FAIL** — critical blockers remain |

**Verdict: Do not deploy yet.** Full-track playback depends on a JioSaavn sidecar that is currently unreachable (`http://localhost:3099`). On Render, `localhost:3099` will never work. Fix providers + production env before shipping.

---

## 2. Root Cause of ~29–30 Second Playback

### Confirmed mechanism

1. Many catalog hits (especially Bollywood search) come from **Deezer** via SayaMusicAPI.
2. Deezer “stream” is a **30-second preview** CDN URL (`cdnt-preview.dzcdn.net`), not a full file.
3. The app tries `POST /api/music/upgrade-full` to replace previews with **full JioSaavn** downloads.
4. **JioSaavn sidecar is DOWN** (`JIOSAAVN_API_BASE_URL=http://localhost:3099` → connection refused).
5. Upgrade fails (`fetch failed`); stream falls back to Deezer preview → playback ends at ~30s.
6. Metadata previously showed **full catalog duration** (e.g. 261s) while audio was only 30s — misleading UX.

### Evidence (live tests this audit)

| Field | Result |
|--------|--------|
| Track | Tum Hi Ho |
| Artist | Arijit Singh |
| Provider | deezer (`3191972361`) |
| Audio source type | Deezer preview CDN MP3 |
| Stream `isPreview` | `true` |
| Stream `duration` (after fix) | `30` |
| Stream `quality` | `Deezer 30-second preview clip (MP3)` |
| Upgrade-full | `success:false` / `fetch failed` (JioSaavn down) |
| JioSaavn health | `unreachable` |
| Playback completes as full song? | **No** — clip ends ~30s |
| Seeking within clip | Expected to work inside 0–30s (HTML5 audio); not claimed beyond that without browser playback |

**Home without JioSaavn:** featured/charts fell back to **Audius** full tracks (not previews) — so “some songs work fully, Bollywood often dies at 30s.”

### Fix applied (honesty + observability)

- `/api/health` reports JioSaavn reachability + warnings.
- Startup log warns when sidecar is unreachable.
- Deezer preview stream now sets `duration: 30` / `previewDuration: 30` on the track payload.
- Player toasts when playing a preview; TrackRow shows 0:30 for previews, not fake 4:xx.

**Not fixed (requires ops):** run a reachable JioSaavn API for full tracks locally **and** in production (public URL, not `localhost`).

---

## 3. Local vs LAN Differences

| Check | Local | LAN (`10.252.52.85`) | Status |
|-------|-------|----------------------|--------|
| Frontend origin | `http://localhost:3000` | `http://10.252.52.85:3000` | Same Vite app |
| API base (dev) | `http://localhost:8080/api` via hostname | `http://10.252.52.85:8080/api` via hostname | **PASS** (`apiConfig.ts`) |
| CORS ACAO | `http://localhost:3000` | `http://10.252.52.85:3000` | **PASS** |
| Backend bind | `0.0.0.0:8080` | Reachable on LAN IP | **PASS** |
| MongoDB | Atlas connected | Same backend process | **PASS** |
| JioSaavn | localhost:3099 (same machine) | Same — still local sidecar | **FAIL** if process down |
| Clerk | localhost allowed by default | Needs Clerk Dashboard allowed origin | **WARNING** |
| Feature codepaths | Identical | Identical | **PASS** |

**Why LAN felt “missing features”**

1. **Preview-only Bollywood** when JioSaavn is down (same on local if sidecar is down).
2. **Clerk / library** (favorites, history, playlists) require sign-in — 401 without token on both; LAN sign-in may fail until origin is allow-listed.
3. **Stale browser cache** / old frontend still pointing at `localhost:8080` on the phone (fixed in code; hard-refresh required).
4. No separate “LAN build” — one codebase.

---

## 4. Feature Inventory

Only features that exist in the repo are listed.

| Feature | Status | Notes |
|---------|--------|-------|
| Home discovery shelves | **PASS** | Works; content quality drops without JioSaavn |
| Charts / trending | **PASS** | API 200 |
| Music search | **PASS** | Deezer/Audius when JioSaavn down |
| Search artists/albums/playlists | **PASS** | Routes exist; exercised via search APIs |
| Genre browsing | **PASS** | `/api/music/genres` 200 |
| External album/artist/playlist pages | **PASS** | Routes in `App.tsx` |
| Player play/pause | **PASS** | Existing |
| Next / previous | **PASS** | Existing `playNext` / `playPrev` |
| Seek | **PASS** | Slider uses real audio duration (now honest for previews) |
| Shuffle / repeat | **PASS** | Existing |
| Queue + Play next / Add to queue | **PASS** | Implemented |
| Favorites | **PASS** (API) | 401 unauth expected; scoped by `userId` |
| History / recently played | **PASS** (API) | Same |
| User playlists add/remove | **PASS** (code) | Auth required; not browser E2E this run |
| Clerk login/logout | **WARNING** | Works locally; LAN needs Clerk origin config |
| Responsive / mobile nav | **PASS** | Present |
| Radio / podcasts / lyrics | **PASS** | Routes + controllers present |
| Admin uploads | **BLOCKED** | Cloudinary credentials missing |
| spotDL / node-spdl | **NOT IMPLEMENTED** | Intentionally unused |
| Rate limiting | **NOT IMPLEMENTED** | Security WARNING |
| Automated unit/E2E tests | **NOT IMPLEMENTED** | `npm test` placeholder |

---

## 5. Files Modified (this audit)

| File | Change |
|------|--------|
| `backend/src/index.js` | `/api/health`, JioSaavn startup probe |
| `backend/src/lib/corsOrigins.js` | `FRONTEND_URL` / `CLIENT_URL` support |
| `backend/src/services/music/musicStream.service.js` | Honest preview `duration: 30` |
| `backend/.env.sample` | Prod CORS + JioSaavn notes |
| `frontend/src/stores/usePlayerStore.ts` | Preview toast + duration clamp |
| `frontend/src/components/music/TrackRow.tsx` | Display preview duration |
| `frontend/vercel.json` | SPA rewrite for Vercel |
| `frontend/.env.sample` | Prod `VITE_API_BASE_URL` notes |
| `PRE_DEPLOYMENT_AUDIT_REPORT.md` | This report |

**Checkpoint:** `git stash@{0}: checkpoint-pre-deployment-audit-20261103-2259`

---

## 6. Music Provider Results

| Provider | Role | Result |
|----------|------|--------|
| SayaMusicAPI | Discovery / Deezer / Audius / Apple | **PASS** — configured & responding |
| Deezer | Search + 30s preview stream | **PASS** as preview; **FAIL** as full song |
| JioSaavn sidecar | Full-track upgrade / search | **FAIL** — unreachable at `http://localhost:3099` |
| Audius | Full streams via Saya | **PASS** on home fallback |
| Apple | Preview-only path | Same preview upgrade dependency as Deezer |
| Radio-browser | Radio | Not load-tested this run → **NOT TESTED** |

---

## 7. Frontend Test Results

| Check | Status |
|-------|--------|
| `npm run build` (`tsc -b && vite build`) | **PASS** |
| Hardcoded `localhost:8080` in `src/` | **PASS** — removed; hostname-based `apiConfig` |
| `vercel.json` SPA fallback | **PASS** (added) |
| Prod API URL without env | **WARNING** — relative `/api` only works if FE+BE same host; Vercel needs `VITE_API_BASE_URL` |
| Browser E2E on device | **NOT TESTED** this session (API-level verification used) |

---

## 8. Backend Test Results

| Check | Status |
|-------|--------|
| Listen `0.0.0.0` + `PORT` from `.env` | **PASS** |
| MongoDB Atlas connect | **PASS** |
| `GET /api/health` | **PASS** |
| `GET /api/music/home` | **PASS** (200) |
| `GET /api/music/genres` | **PASS** (200) |
| `GET /api/library/favorites` (no auth) | **PASS** (401 + CORS) |
| `GET /api/library/history` (no auth) | **PASS** (401 + CORS) |
| LAN CORS preflight/GET | **PASS** |
| `npm test` | **FAIL** — no tests defined |
| JioSaavn-dependent upgrade | **FAIL** until sidecar runs |

---

## 9. Security Findings

| Finding | Severity | Status |
|---------|----------|--------|
| CORS credentials with explicit allow-list (not `*`) | OK | **PASS** |
| Library queries filtered by Clerk `userId` | OK | **PASS** |
| Auth not disabled to “fix” CORS | OK | **PASS** |
| Secrets in frontend bundle | Only Clerk **publishable** key (expected) | **PASS** |
| `CLERK_SECRET_KEY` / Mongo URI only on backend | OK | **PASS** |
| Cloudinary empty — uploads disabled | OK | **WARNING** |
| No rate limiting on music/search | Gap | **WARNING** |
| No automated authz tests | Gap | **WARNING** |
| `npm audit` | Run partially; treat as **WARNING** until clean in CI | **WARNING** |
| `.env` committed? | Ensure never committed | Manual check required |

---

## 10. Vercel Readiness

| Item | Status |
|------|--------|
| Vite build | **PASS** |
| SPA rewrites (`frontend/vercel.json`) | **PASS** |
| `VITE_CLERK_PUBLISHABLE_KEY` (prod) | **WARNING** — set in Vercel |
| `VITE_API_BASE_URL=https://<render>/api` | **FAIL** until set |
| `VITE_SOCKET_URL=https://<render>` | **FAIL** until set |
| Clerk allowed origins / redirect URLs for Vercel domain | **FAIL** until configured |

---

## 11. Render Readiness

| Item | Status |
|------|--------|
| Start command `npm start` / `node src/index.js` | **PASS** |
| `PORT` + `0.0.0.0` | **PASS** |
| Health check path `/api/health` | **PASS** |
| `MONGODB_URI` | **PASS** (Atlas already used) |
| `CORS_ORIGIN` / `FRONTEND_URL` = Vercel URL | **FAIL** until set |
| `CLERK_SECRET_KEY` + publishable | **FAIL** until set on Render |
| `JIOSAAVN_API_BASE_URL` | **FAIL** — must be a **public** service URL, not `localhost:3099` |
| `SAYA_API_BASE_URL` | **PASS** pattern exists |
| Do not log secrets | **PASS** (health omits secrets) |

---

## 12. Environment Variables Required

### Backend (Render)

```env
PORT=8080
NODE_ENV=production
MONGODB_URI=...
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
ADMIN_EMAIL=...
CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
SAYA_API_BASE_URL=https://sayamusicapi.sayaproject-mailflow.workers.dev
JIOSAAVN_API_BASE_URL=https://YOUR-PUBLIC-JIOSAAVN-HOST
JIOSAAVN_API_TIMEOUT_MS=20000
# Optional Cloudinary for admin uploads
```

### Frontend (Vercel)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_BASE_URL=https://your-api.onrender.com/api
VITE_SOCKET_URL=https://your-api.onrender.com
```

### Local LAN (current)

```env
# backend
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://10.252.52.85:3000
JIOSAAVN_API_BASE_URL=http://localhost:3099   # must be RUNNING for full tracks

# frontend — optional; auto hostname works if unset
# VITE_API_BASE_URL=http://10.252.52.85:8080/api
```

---

## 13. Remaining Blockers (before deploy)

1. **CRITICAL:** Start and keep JioSaavn sidecar healthy locally; for Render, deploy it (or equivalent) at a public URL and set `JIOSAAVN_API_BASE_URL`.
2. **CRITICAL:** Set Vercel `VITE_API_BASE_URL` / `VITE_SOCKET_URL` to the Render API (absolute HTTPS).
3. **CRITICAL:** Set Render `CORS_ORIGIN` / `FRONTEND_URL` to the Vercel origin.
4. **HIGH:** Configure Clerk production/LAN allowed origins and redirect URLs.
5. **MEDIUM:** Add real automated tests (or at least API smoke in CI).
6. **MEDIUM:** Consider rate limiting on `/api/music/*`.
7. **LOW:** Cloudinary if admin uploads are required in prod.

### Immediate local fix for 30s songs

```bash
# In the JioSaavn API project (separate process), e.g.:
# PORT=3099 npm run dev
# Then verify:
curl http://127.0.0.1:8080/api/health
# providers.jiosaavn.ok should be true
```

Then hard-refresh LAN clients (`Ctrl+Shift+R`).

---

## Category Status Rollup

| Category | Status |
|----------|--------|
| 1. Executive / parity | **WARNING** |
| 2. 30s playback diagnosis | **PASS** (cause known) |
| 2b. Full-track playback | **FAIL** |
| 3. Feature testing | **WARNING** (API-heavy; limited browser E2E) |
| 4. Backend & DB | **WARNING** |
| 5. Vercel readiness | **WARNING** |
| 5b. Render readiness | **WARNING** |
| 6. Security | **WARNING** |
| 7. Automated testing | **FAIL** / **NOT TESTED** |
| 8. Deploy now? | **FAIL** — do not deploy |

---

*End of report. No automatic deployment was performed.*
