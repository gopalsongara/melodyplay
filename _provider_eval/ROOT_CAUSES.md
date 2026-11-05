# Root causes (identified before production edits)

Checkpoint: `stash@{0}: checkpoint-search-provider-artwork-20261104`

## Artwork missing after Deezer removal

1. **Deezer was the primary artwork-rich catalog** for albums/artists/home charts. After removal, MelodyPlay leans on JioSaavn + Audius + Apple.
2. **Local JioSaavn sidecar (`localhost:3099`) is unreachable** in this environment → album/artist/playlist searches return empty; track artwork from Jio is also gone.
3. **`mapArtist` branch order bug**: condition `provider === "deezer" || item.type === "artist"` runs *before* the JioSaavn branch. JioSaavn artists with `type: "artist"` are mapped with Deezer image fields (`picture_xl`…), so `pickImage` falls through to the shared Cloudinary placeholder for every artist.
4. **`mapAlbum` / `mapPlaylist` still carry Deezer-default provider strings** in fallback branches (risk if non-Jio payloads use `type: album|playlist`).
5. Frontend already has `onError` fallbacks; the main issue is bad/missing URLs from mapping, not missing lazy-load.

## Albums not appearing

1. Catalog search defaults to JioSaavn only for albums (Audius has no album search adapter).
2. With sidecar down and Deezer gone, album arrays are empty.
3. No Apple/iTunes album search wired despite public iTunes Search API availability.
4. Album detail routes only implement JioSaavn (501 for others) — expected capability gap, not fake data.

## Search quality

1. Ranking is substring/token based only — no typo / transliteration layer (`Arjit` ≠ `Arijit`).
2. No query expansion; original query is sent as-is to providers.
3. Partial provider failure is already mostly isolated via `safeCall`, but there is no per-provider timeout orchestration layer or shared search cache beyond client TTL.

## Candidate GitHub wrappers (not independent catalogues)

All JioSaavn wrappers hit the same upstream; do not treat as separate catalogs. Live public probes this session: NepoTune → HTTP 402; shnwaz public host → fetch failed; local sidecar → down. `@saavn-labs/sdk` is MIT TypeScript SDK (not installed into main app). AudiusProject remains the authorized open-platform track source via Saya.
