# MelodyPlay — Production Readiness Report

**Date:** 2026-11-03  
**Branch:** `master`  
**Checkpoints (non-destructive):**
- `git stash@{0}` → `checkpoint-production-readiness-20261103-2311`
- `git stash@{1}` → `checkpoint-pre-deployment-audit-20261103-2259`
- Branch tip: `checkpoint/production-readiness-20261103` (points at last committed HEAD)

**Deployment performed:** No (manual staging only)

---

## 1. Executive Summary

| Area | Verdict |
|------|---------|
| Architecture preserved | **PASS** |
| Preview honesty | **FIXED** |
| Full-track Bollywood via JioSaavn | **BLOCKED** (sidecar down + production attestation required) |
| LAN/local API parity | **FIXED** / **PASS** |
| Clerk + library isolation | **PASS** (code + tests); Clerk dashboard config still manual |
| Rate limiting | **FIXED** |
| Automated tests | **FIXED** — backend **12/12**, frontend **3/3** |
| Frontend production build | **PASS** |
| Vercel / Render configs | **PARTIALLY FIXED** (files + docs; secrets not applied) |
| **Final deployment verdict** | **READY FOR STAGING** — **NOT READY** for production full-track claims |

MelodyPlay is stable enough for a **staging** deploy of the API + SPA with **preview-aware playback** and Audius full streams. Do **not** market or rely on JioSaavn full tracks in production until a public, authorized sidecar is attested (`JIOSAAVN_AUTHORIZED=true`).

---

## 2. Original Audit Findings (from `PRE_DEPLOYMENT_AUDIT_REPORT.md`)

| Finding | Prior status | Now |
|---------|--------------|-----|
| Deezer ~30s previews | Diagnosed | **FIXED** honesty + capability model |
| JioSaavn `localhost:3099` unreachable | FAIL | Still **BLOCKED** locally; production guard added |
| Fake full duration on previews | Fixed partially | **FIXED** (API + UI + tests) |
| No `npm test` | FAIL | **FIXED** |
| LAN CORS / API host | PASS | **PASS** |
| Vercel/Render env incomplete | WARNING | Documented + `render.yaml` / `vercel.json` |

---

## 3. Root Causes

1. **30s cutoffs:** Deezer/Apple streams are preview clips; full upgrade depends on JioSaavn sidecar. Sidecar was down → upgrade failed → preview played while UI sometimes showed catalog duration.
2. **LAN “missing features”:** Same codebase; differences from auth (Clerk LAN origins), provider availability, and stale clients — not a separate LAN build.
3. **Deploy risk:** `JIOSAAVN_API_BASE_URL=http://localhost:3099` cannot work on Render.
4. **Authorization gap:** Technical reachability ≠ licensed full-track redistribution rights for JioSaavn-style sidecars.

---

## 4. Issues Fixed

| Issue | Status |
|-------|--------|
| Provider capability model | **FIXED** |
| Production JioSaavn upgrade gate (`JIOSAAVN_AUTHORIZED`) | **FIXED** |
| Preview duration honesty (Deezer/Apple + UI) | **FIXED** |
| `/api/health` includes capabilities + warnings | **FIXED** |
| Rate limiting on music/search + library writes | **FIXED** |
| Express `createApp` + graceful SIGTERM/SIGINT | **FIXED** |
| Automated backend + frontend tests | **FIXED** |
| `render.yaml` + env sample docs | **FIXED** |
| Prod localhost API URL console guard | **FIXED** |
| JioSaavn full tracks without sidecar/auth | **BLOCKED** (documented; no illegal workaround) |
| npm audit transitive vulns (ws/socket.io) | **PARTIALLY FIXED** — not force-upgraded; remaining risk documented |
| Clerk browser E2E on LAN/prod domains | **NOT TESTED** (dashboard config required) |
| Live Hindi/English/Punjabi full-track E2E with authorized source | **PARTIALLY FIXED** — API-level Deezer preview verified; Audius full on home when JioSaavn down |

---

## 5. Files Modified / Added

### Backend
- `src/app.js` (new) — Express app factory
- `src/index.js` — listen + graceful shutdown
- `src/services/music/providerCapabilities.js` (new)
- `src/services/music/musicStream.service.js` — auth gate + Apple honesty
- `src/lib/playbackHonesty.js` (new)
- `src/middleware/rateLimit.js` (new)
- `tests/*.test.js` (new)
- `package.json` — test script
- `render.yaml` (new)
- `.env.sample` — attestation + rate limits

### Frontend
- `src/lib/playbackDisplay.ts` + `.test.ts`
- `src/components/music/TrackRow.tsx`
- `src/lib/apiConfig.ts`
- `vitest.config.ts`
- `package.json` — vitest
- `vercel.json` (existing SPA rewrite)

### Docs
- `MELODPLAY_PRODUCTION_READINESS_REPORT.md` (this file)
- Prior: `PRE_DEPLOYMENT_AUDIT_REPORT.md`

---

## 6. Provider Authorization & Playback Results

| Provider | Full | Preview | Seeking | Auth required | Authorization status | Notes |
|----------|------|---------|---------|---------------|----------------------|-------|
| Deezer | No | Yes (~30s) | Yes | No | `preview_api_via_saya` | Verified stream `duration:30` |
| Apple | No | Yes (~30s) | Yes | No | `preview_api_via_saya` | Honest duration applied |
| Audius | Yes | — | Yes | No | `open_platform_via_saya` | Home fallback when JioSaavn down |
| JioSaavn | Conditional | — | Yes | No (sidecar) | `operator_attestation_required` | **Disabled in production** until `JIOSAAVN_AUTHORIZED=true` + public URL |
| Radio Browser | Live | — | Limited | No | `public_radio_streams` | Not load-tested this run |

**Legal stance:** JioSaavn sidecar kept **isolated** and **opt-in**. No DRM bypass, no spotDL, no unauthorized decryption added.

---

## 7. Local / LAN Parity

| Check | Local | LAN | Status |
|-------|-------|-----|--------|
| API host resolution | `hostname:8080` | `10.252.52.85:8080` | **PASS** |
| CORS | localhost:3000 | 10.252.52.85:3000 | **PASS** |
| Feature code | Same | Same | **PASS** |
| Clerk | Needs allowlist | Needs `http://10.252.52.85:3000` | Manual |
| JioSaavn | localhost:3099 | Same machine | **BLOCKED** if process down |

---

## 8. Authentication & Library

| Check | Result |
|-------|--------|
| Library routes behind `protectRoute` | **PASS** |
| Unauthenticated favorites/history/playlists → 401 | **PASS** (automated) |
| Queries scoped by `userId` | **PASS** (static isolation test) |
| User A ↔ User B cross-access | **NOT TESTED** live with two Clerk users (code path scoped) |

### Clerk dashboard (manual)

**LAN:** add `http://10.252.52.85:3000` to allowed origins / redirect URLs.  
**Production:** add `https://<vercel-domain>` sign-in/out redirects and authorized parties.

---

## 9. Backend / Database

| Check | Status |
|-------|--------|
| MongoDB Atlas connect (existing) | **PASS** |
| Indexes on favorites/history/playlists | **PASS** (already present) |
| Health endpoint | **PASS** |
| Graceful shutdown | **FIXED** |
| Rate limits | **FIXED** |
| Schema migrations | None required |

---

## 10. Security Results

| Item | Status |
|------|--------|
| CORS allow-list + credentials (no `*`) | **PASS** |
| Secrets not in frontend bundle | **PASS** (publishable Clerk key only) |
| Rate limiting music/search/library writes | **FIXED** |
| Production JioSaavn disabled without attestation | **FIXED** |
| npm audit (transitive ws/socket.io etc.) | **WARNING** — avoid `--force`; monitor |
| Auth not weakened | **PASS** |

---

## 11. Automated Test Results

### Backend (`npm test`)
```
# tests 12
# suites 5
# pass 12
# fail 0
```
Coverage: health, library 401s, provider capabilities, production JioSaavn gate, playback honesty, rate limit, library isolation.

### Frontend (`npm test`)
```
Test Files  1 passed
Tests  3 passed
```
Coverage: preview duration display, playback labels.

### Frontend build
`npm run build` → **PASS** (verified in this session).

---

## 12. Vercel Configuration

**Root / project:** `frontend`  
**Build:** `npm run build`  
**Output:** `dist`  
**Rewrites:** `frontend/vercel.json` → SPA fallback

### Env vars
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_BASE_URL=https://<render-service>.onrender.com/api
VITE_SOCKET_URL=https://<render-service>.onrender.com
```

Do **not** set these to localhost in production.

---

## 13. Render Configuration

**Root:** `backend`  
**Start:** `npm start`  
**Health:** `/api/health`  
**Blueprint sample:** `backend/render.yaml`

### Env vars
```env
NODE_ENV=production
PORT=8080
MONGODB_URI=...
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CORS_ORIGIN=https://<vercel-app>.vercel.app
FRONTEND_URL=https://<vercel-app>.vercel.app
SAYA_API_BASE_URL=https://sayamusicapi.sayaproject-mailflow.workers.dev
JIOSAAVN_API_BASE_URL=https://<public-sidecar-if-authorized>
JIOSAAVN_AUTHORIZED=false
RATE_LIMIT_MUSIC_MAX=90
RATE_LIMIT_LIBRARY_MAX=60
```

**Never** leave `JIOSAAVN_API_BASE_URL=http://localhost:3099` on Render.

---

## 14. Remaining Blockers

1. **CRITICAL for full Bollywood tracks:** Public authorized full-track provider (or attested JioSaavn sidecar). Until then, production must accept Deezer/Apple **previews** + Audius full where available.
2. **HIGH:** Configure Clerk + CORS for Vercel domain before staging auth works.
3. **HIGH:** Set absolute `VITE_API_BASE_URL` on Vercel.
4. **MEDIUM:** Live two-user isolation E2E; browser LAN hard-refresh verification.
5. **MEDIUM:** Dependency audit cleanup without breaking Socket.IO.
6. **LOW:** Cloudinary for admin uploads.

---

## 15. Rollback Instructions

Non-destructive checkpoints (no `reset --hard` / `clean` used):

```bash
# Inspect checkpoints
git stash list
# stash@{0}: checkpoint-production-readiness-20261103-2311
# stash@{1}: checkpoint-pre-deployment-audit-20261103-2259

# Restore working tree to a checkpoint (keeps stash entry)
git stash show -p stash@{0} | git apply -R   # reverse apply of later work — prefer selective file restore

# Safer: copy files from stash without dropping it
git checkout stash@{0} -- path/to/file

# Branch pointer at pre-work commit tip
git log checkpoint/production-readiness-20261103 -1
```

To discard only new uncommitted files from this session, restore selectively from `stash@{0}` contents rather than wiping the tree.

---

## Staging Checklist (manual — not auto-deployed)

| Step | Local | LAN | Staging |
|------|-------|-----|---------|
| `/api/health` | Tested | Tested (prior) | Not tested |
| Home load | Code OK | Not re-browser-tested | Not tested |
| Search | API OK | Not re-browser-tested | Not tested |
| Preview vs full honesty | API + unit tests | Not re-browser-tested | Not tested |
| Clerk login | Not E2E this run | Needs dashboard | Needs dashboard |
| Favorites/history/playlists API 401 | Tested | — | — |
| Mobile nav | Code present | Not tested | Not tested |

---

## Final Verdict

**READY FOR STAGING**

**NOT READY** for production if the product requirement is reliable full-length licensed Bollywood/catalog playback via JioSaavn.

Staging is appropriate for: SPA + API + Clerk + preview-honest player + Audius/Saya discovery, with clear Preview labels and no fake full durations.
