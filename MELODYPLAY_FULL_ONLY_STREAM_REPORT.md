# MelodyPlay — Full-Only Streams (No 30s Previews)

Date: 2026-11-04

## Goal
Song search must never show 30-second preview clips. If a track is not a full authorized stream, remove it from song results.

## Research summary (authorized APIs)

| Source | Full stream? | Bollywood coverage | Status |
|--------|--------------|--------------------|--------|
| **JioSaavn** (sidecar) | Yes | Strong | Wired; sidecar often down locally (`localhost:3099`) |
| **Audius** (official / Saya) | Yes | Weak (UGC / covers) | Live — primary full provider when Jio is down |
| **Jamendo** (CC, `client_id`) | Yes | Indie / CC only | Integrated; needs `JAMENDO_CLIENT_ID` in `.env` |
| Apple iTunes | **30s only** | Strong metadata | Removed from song search |
| Deezer | Preview | — | Permanently blocked |
| YouTube extract / scrape | N/A | — | **Rejected** (ToS / unauthorized) |
| YouTube Data API | Metadata only | — | No audio stream rights |

**Conclusion:** No GitHub YouTube-extract project is acceptable. Viable authorized full APIs: JioSaavn + Audius + Jamendo.

## Code changes
- Hard filter `filterFullPlayableOnly` / `isFullPlayableTrack` on track + adjacent search.
- Default track providers: `jiosaavn,audius,jamendo` (Apple removed).
- Apple song search + artist top-tracks listing disabled for playback rows.
- Jamendo client + mapper + stream resolve (when `JAMENDO_CLIENT_ID` set).
- Frontend strips Apple / `isPreview` song rows as defense-in-depth.

## Live API verification (port 8080)

| Query | Tracks | Preview/Apple/Deezer | Providers |
|-------|--------|----------------------|-----------|
| Tum Hi Ho | 12 | **0** | audius |
| Qaafirana | 12 | **0** | audius |
| Believer | 12 | **0** | audius |
| electronic chill | 12 | **0** | audius |
| `/music/search/tracks?q=Tum Hi Ho` | 10 | **0** | audius |

## Enable Jamendo
1. Create app at https://developer.jamendo.com/
2. Add to `backend/.env`: `JAMENDO_CLIENT_ID=<your_id>`
3. Restart backend — CC full tracks join search automatically.

## Note on catalog gaps
Without JioSaavn sidecar, Bollywood official masters may be missing; Audius returns full-length user uploads / covers instead of label masters. Start the Jio sidecar on `3099` for official Indian catalog full streams.
