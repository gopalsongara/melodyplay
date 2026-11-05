# Multi-Provider Evaluation Report

**Date:** 2026-11-04  
**Checkpoint:** `checkpoint-multi-provider-catalogue-20261104`  
**Baseline tests before changes:** backend 37/37 pass  

Isolated eval directory: `_provider_eval/multi/` (not linked into app `package.json`).

---

## Summary verdicts

| Provider / Candidate | Verdict | Playback |
| --- | --- | --- |
| JioSaavn (existing sidecar) | PARTIALLY WORKING (sidecar down this session) | PLAYBACK NOT VERIFIED here |
| Audius via Saya | PARTIALLY WORKING — high noise for Bollywood artist queries | PLAYBACK VERIFIED previously (full stream) |
| Apple / iTunes Search | **WORKING** — best relevance for Shreya/Arijit catalogue | METADATA ONLY + preview |
| MusicBrainz | **WORKING** — artist identity | METADATA ONLY |
| Cover Art Archive | WORKING (with MBID) | METADATA ONLY |
| Radio Browser | WORKING (existing) | PLAYBACK VERIFIED (live) |
| Internet Archive | CAPABILITY RETAINED | PLAYBACK NOT VERIFIED this pass |
| Deezer | BLOCKED | — |
| node-youtube-music | **UNAVAILABLE** (HTTP 404 all queries) | — |
| ytmusicapi (Python) | **NOT EVALUATED LIVE** — skipped; Node YT Music already broken; no Python microservice unless Node fails *and* unique coverage justified | — |
| notdeltaxd/Gaana-API | **UNAVAILABLE** (no reachable public deploy) | Stream decryption = not authorized for MelodyPlay |
| shnwazdev-GaanaAPI | **UNAVAILABLE** (Vercel HTTP 402) | Same upstream concerns |
| Beatbump | REFERENCE ONLY | Do not copy / do not bypass YT |

---

## Detailed results

### A. Existing

#### JioSaavn
- Local `localhost:3099`: `fetch failed`
- Unique Hindi full-track catalogue when healthy — keep integration
- Status: PARTIALLY WORKING / UNAVAILABLE locally

#### Audius (`Shreya Ghoshal`, limit 10)
- Success, ~10 results
- **Relevant primary-artist matches: poor** (ringtones, slowed+reverb, third-party uploads titled with her name)
- Status: PARTIALLY WORKING — useful for indie/open tracks, harmful if over-ranked on Bollywood artist queries

#### Apple / iTunes
- Songs `Shreya Ghoshal`: 25 results, **25 relevant** (artist credit includes Shreya)
- Albums: 25 results, **25 relevant**
- Artists: correct `Shreya Ghoshal` (id `19715559`)
- Status: WORKING | METADATA ONLY | PREVIEW available for songs

#### MusicBrainz
- Artist query exact match: 1 person `Shreya Ghoshal`
- Status: WORKING | METADATA ONLY

### B. Candidates

#### baptisteArno/node-youtube-music
- Installed only under `_provider_eval/multi`
- All searchMusics / searchArtists / searchAlbums / getArtist / listMusicsFromAlbum → **Response code 404**
- Status: UNAVAILABLE / UNRELIABLE  
- **Reject production integration**
- Even if revived: MelodyPlay would use **official embed only**, never stream extraction

#### sigma67/ytmusicapi
- Not installed (Python infra unnecessary given Node package failure and embed-only policy)
- Status: REJECTED for this cycle

#### Gaana APIs
- shnwazdev public: **402 Payment required**
- notdeltaxd public: **404** (no deployment)
- Both advertise decrypted HLS streams → **must not** be used as authorized full playback
- Same Hindi catalogue space as JioSaavn → low unique-coverage value without a healthy self-hosted sidecar + legal review
- Status: UNAVAILABLE | **Reject integration this cycle**

#### Beatbump
- Architecture reference only — no code copied

---

## Integration decision (Phase 3)

**Integrate / improve:**
1. Apple/iTunes — more results, artist lookup discography, stricter album filters
2. MusicBrainz — artist confirmation + release-group albums (metadata)
3. Ranking fixes — relevance over playback; demote Audius noise on artist queries
4. Preserve JioSaavn / Audius / Radio Browser / Archive capabilities

**Do not integrate:**
- node-youtube-music, ytmusicapi, both Gaana wrappers (unavailable or unauthorized stream model)

---

## Notes on search quality bug

Observed product issue (“Shreya Ghoshal → 1–2 relevant songs, unrelated noise”) matches Audius-heavy ranking when Jio is down, with playback boosts previously able to outrank exact artist matches. Fix: relevance-first ranking + Apple artist song lookup + album artist filtering.
