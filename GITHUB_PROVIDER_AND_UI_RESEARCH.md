# MelodyPlay — GitHub Provider & UI Research

**Date:** 2026-11-04  
**Purpose:** Evaluate open-source music apps/APIs for reusable architecture ideas and compatible, properly licensed integrations. Spotify is used as a UX reference only — no logos, trademarks, or proprietary streams.

---

## 1. Spotify UX research (reference only)

Sources reviewed:
- https://developer.spotify.com/documentation/design
- https://developer.spotify.com/documentation/web-api/reference/search
- Public UX write-ups of Spotify web search / home (Top result card, category filters, horizontal shelves)

### Findings applied to MelodyPlay

| Surface | Spotify pattern | MelodyPlay action |
| --- | --- | --- |
| Home | Greeting + recently played + shelves | Kept greeting, jump-back-in, recommended, moods |
| Search | Top result + Songs/Artists/Albums/Playlists + filter chips | Added All/Songs/Artists/Albums/Playlists chips; Top result card |
| Artist | Large hero, Popular, Albums, Singles | Hero gradient + Popular + Albums shelf + Singles |
| Album | Large cover, metadata, tracklist, Play/Shuffle | Hero art, year/count/duration, Play/Shuffle, real provider tracklist |
| Player | Persistent bar, honest status | Preview labelling retained; clearer upstream error toasts |

**Spotify Web API:** Suitable only with official OAuth, quotas, and commercial terms. Not integrated as a MelodyPlay catalogue/stream source in this pass (terms + quota risk). Design guidelines prohibit using Spotify branding/assets.

---

## 2. Required repositories evaluated

| Repository | Accessible | Maintained | License | Usable APIs | Verdict for MelodyPlay |
| --- | --- | --- | --- | --- | --- |
| [JonniTech/Spotify-Clone](https://github.com/JonniTech/Spotify-Clone) (Tevify) | Yes | Recent (2026) | **None listed** | Jamendo CC streams | **UI ideas only** — no license → do not copy code; Jamendo is CC-friendly but separate catalogue |
| [pulkitdotio/spotify-clone](https://github.com/pulkitdotio/spotify-clone) | Yes | Older MERN tutorial style | Check repo | Often local Mongo songs | **Architecture reference only** — not a live catalogue provider |
| [francoborrelli/spotify-react-web-client](https://github.com/francoborrelli/spotify-react-web-client) | Yes | Active | MIT | Spotify Web API + Playback SDK | **Reject as provider** — requires Spotify auth/SDK; useful for layout patterns only |
| [snuffyDev/Beatbump](https://github.com/snuffyDev/Beatbump) | Yes | **Archived** | AGPL-3.0 | YouTube Music unofficial | **Reject playback** — YT Music scraping/unofficial; AGPL viral; architecture notes only |
| [sigma67/ytmusicapi](https://github.com/sigma67/ytmusicapi) | Yes | Very active | MIT | Unofficial YT Music | **Reject for MelodyPlay streams** — unauthorized extraction risk; metadata-only would still violate product rules |
| [baptisteArno/node-youtube-music](https://github.com/baptisteArno/node-youtube-music) | Yes | Sporadic | Check repo | Unofficial YT Music | **Previously 404; retested conceptually** — still unsuitable (unauthorized audio) |

---

## 3. Additional discovery searches

| Search theme | Notable candidates | Outcome |
| --- | --- | --- |
| Open source React music player | Tevify, various Vite players | UI patterns (shelves, mini-player) |
| Music discovery API Node | MusicBrainz, iTunes Search, Audius | Already integrated |
| Album artwork API | Cover Art Archive | Already integrated |
| Open music streaming | Audius, Internet Archive, Jamendo, Radio Browser | Audius/Archive/Radio kept; Jamendo optional future (CC) |

---

## 4. Existing MelodyPlay providers (re-validated)

| Provider | Live status (2026-11-04) | Role |
| --- | --- | --- |
| Apple / iTunes | Working | Songs, albums, artists, discography, ~30s previews |
| MusicBrainz | Working (rate-limited) | Metadata / identity |
| Cover Art Archive | Working | Artwork enrichment |
| Audius (via Saya) | Working | Full streams; noisy uploads filtered |
| JioSaavn sidecar | Unreachable locally | Full tracks when authorized + online |
| Radio Browser | Working | Live radio |
| Internet Archive | Partial via Saya | Capability retained; 404/502 not advertised as full |
| Deezer | **Blocked** | 410 on stream/preview |

---

## 5. Integration decisions

**Integrated / retained:** Apple, MusicBrainz, CAA, Audius, JioSaavn (when up), Radio Browser, Archive (cautious).

**Rejected for playback:**
- YouTube Music APIs / Beatbump (unauthorized / ToS)
- Spotify Web API as MelodyPlay stream source (terms + branding)
- Gaana public wrappers (prior 402/404; no authorized stream)
- Songs.PK-labelled Audius uploads (unverified legacy rip naming — filtered)

**UI ideas reused (not code copied):** Top-result emphasis, category filter chips, artist hero, album hero + tracklist, horizontal shelves.

---

## 6. Security / dependency notes

- Prefer MIT/Apache providers with documented public APIs.
- Avoid AGPL scrapers in the MERN stack without legal review.
- Never extract YouTube audio, decrypt HLS/DRM, or reuse private cookies.
- Treat unofficial “Spotify clone” repos as UI inspiration only.
