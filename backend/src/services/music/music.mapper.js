import { NEUTRAL_ARTWORK_PLACEHOLDER } from "./artwork.service.js";

const PLACEHOLDER_ART = NEUTRAL_ARTWORK_PLACEHOLDER;

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.docs)) return value.docs;
  return [];
};

const decodeHtml = (value) => {
  if (value == null) return value;
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
};

const pickJioImage = (image) => {
  if (!image) return null;
  if (typeof image === "string") {
    return image.replace("50x50", "500x500").replace("150x150", "500x500");
  }
  if (Array.isArray(image)) {
    const preferred = ["500x500", "150x150", "50x50"];
    for (const quality of preferred) {
      const hit = image.find((i) => i?.quality === quality && i?.url);
      if (hit?.url) return hit.url;
    }
    return image.find((i) => i?.url)?.url || null;
  }
  return image?.url || null;
};

const jioArtistLabel = (artists) => {
  if (!artists) return "Unknown Artist";
  if (typeof artists === "string") return artists;
  const lists = [
    ...(artists.primary || []),
    ...(artists.featured || []),
    ...(artists.all || []),
  ];
  const names = [
    ...new Set(
      lists
        .map((a) => (typeof a === "string" ? a : a?.name))
        .filter(Boolean)
        .map(decodeHtml),
    ),
  ];
  return names.length ? names.join(", ") : "Unknown Artist";
};

const pickImage = (...candidates) => {
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "string" && c.trim()) return c;
    if (Array.isArray(c)) {
      const fromArr = pickJioImage(c);
      if (fromArr) return fromArr;
      continue;
    }
    if (typeof c === "object") {
      const nested =
        c.cover_xl ||
        c.cover_big ||
        c.cover_medium ||
        c.picture_xl ||
        c.picture_big ||
        c.picture_medium ||
        c.image ||
        c.url;
      if (typeof nested === "string" && nested.trim()) return nested;
      if (Array.isArray(nested)) {
        const fromArr = pickJioImage(nested);
        if (fromArr) return fromArr;
      }
    }
  }
  return PLACEHOLDER_ART;
};

const toSeconds = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    // MusicBrainz often uses milliseconds
    return value > 10000 ? Math.round(value / 1000) : Math.round(value);
  }
  const n = Number(value);
  if (Number.isFinite(n)) return n > 10000 ? Math.round(n / 1000) : Math.round(n);
  return 0;
};

const trackId = (provider, id) => `${provider}:${id}`;

/** Deezer permanently removed — mapper always returns null (never emit entities). */
export const mapDeezerTrack = () => null;

/** SayaMusicAPI JioSaavn search item (preview-only). */
export const mapJioSaavnSong = (item) => {
  if (!item?.id) return null;
  const previewUrl = item.previewUrl || null;
  return {
    id: trackId("jiosaavn-preview", item.id),
    provider: "jiosaavn-preview",
    providerId: String(item.id),
    type: "track",
    title: item.title || "Unknown",
    artist: item.artist || item.singers || "Unknown Artist",
    album: item.album || null,
    albumId: null,
    artistId: null,
    imgUrl: pickImage(item.image?.replace("50x50", "500x500"), item.image),
    duration: toSeconds(item.durationSeconds),
    audioUrl: previewUrl,
    previewUrl,
    streamUrl: null,
    isPreview: true,
    previewDuration: null,
    mimeType: previewUrl?.includes(".mp4") ? "audio/mp4" : null,
    playable: Boolean(previewUrl),
    explicit: Boolean(item.explicit),
    externalUrl: item.officialUrl || null,
    language: item.language || null,
    year: item.year || null,
    hasLyrics: Boolean(item.hasLyrics),
    expiresAt: null,
  };
};

/**
 * Full-track mapper for shnwazdev-jiosaavn-api song payloads.
 * Uses decrypted CDN downloadUrl (prefers 320kbps).
 */
export const mapJioSaavnFullSong = (item, helpers = {}) => {
  if (!item?.id) return null;

  const {
    pickBestDownloadUrl,
    extractArtistNames,
    extractImageUrl,
  } = helpers;

  const download =
    typeof pickBestDownloadUrl === "function"
      ? pickBestDownloadUrl(item.downloadUrl)
      : { url: null, quality: null };

  const audioUrl = download.url || null;
  const artist =
    typeof extractArtistNames === "function"
      ? extractArtistNames(item.artists)
      : item.artists?.primary?.[0]?.name || "Unknown Artist";

  const imgUrl =
    typeof extractImageUrl === "function"
      ? extractImageUrl(item.image)
      : pickImage(
          Array.isArray(item.image)
            ? item.image.find((i) => i.quality === "500x500")?.url
            : item.image,
        );

  return {
    id: trackId("jiosaavn", item.id),
    provider: "jiosaavn",
    providerId: String(item.id),
    type: "track",
    title: decodeHtml(item.name || item.title || "Unknown"),
    artist: decodeHtml(artist),
    album: decodeHtml(
      item.album?.name ||
        (typeof item.album === "string" ? item.album : null) ||
        "",
    ) || null,
    albumId: item.album?.id ? String(item.album.id) : null,
    artistId: item.artists?.primary?.[0]?.id
      ? String(item.artists.primary[0].id)
      : null,
    imgUrl: pickImage(imgUrl),
    duration: toSeconds(item.duration),
    audioUrl,
    previewUrl: null,
    streamUrl: audioUrl,
    isPreview: false,
    previewDuration: null,
    mimeType: audioUrl ? "audio/mp4" : null,
    playable: Boolean(audioUrl),
    needsStreamResolve: !audioUrl,
    quality: download.quality || null,
    explicit: Boolean(item.explicitContent),
    externalUrl: item.url || null,
    language: item.language || null,
    year: item.year || null,
    hasLyrics: Boolean(item.hasLyrics),
    expiresAt: null,
  };
};

export const mapAudiusTrack = (item) => {
  if (!item?.id) return null;
  const artwork =
    item.artwork?.["480x480"] ||
    item.artwork?.["150x150"] ||
    item.artwork?.["1000x1000"] ||
    null;

  return {
    id: trackId("audius", item.id),
    provider: "audius",
    providerId: String(item.id),
    type: "track",
    title: item.title || "Unknown",
    artist: item.user?.name || item.user?.handle || "Unknown Artist",
    album: null,
    albumId: null,
    artistId: item.user?.id ? String(item.user.id) : null,
    imgUrl: pickImage(artwork),
    duration: toSeconds(item.duration),
    audioUrl: null, // resolved via stream endpoint
    previewUrl: null,
    streamUrl: null,
    isPreview: false,
    previewDuration: null,
    mimeType: "audio/mpeg",
    playable: true, // stream resolvable
    needsStreamResolve: true,
    explicit: false,
    externalUrl: item.permalink
      ? `https://audius.co${item.permalink}`
      : null,
    genre: item.genre || null,
    mood: item.mood || null,
    expiresAt: null,
  };
};

/** Jamendo CC full track (authorized stream URL in `audio`). */
export const mapJamendoTrack = (item) => {
  if (!item?.id) return null;
  const audioUrl = item.audio || null;
  if (!audioUrl) return null;
  return {
    id: trackId("jamendo", item.id),
    provider: "jamendo",
    providerId: String(item.id),
    type: "track",
    title: item.name || "Unknown",
    artist: item.artist_name || "Unknown Artist",
    album: item.album_name || null,
    albumId: item.album_id ? String(item.album_id) : null,
    artistId: item.artist_id ? String(item.artist_id) : null,
    imgUrl: pickImage(
      item.album_image,
      item.image,
      item.artist_image,
    ),
    duration: toSeconds(item.duration),
    audioUrl,
    previewUrl: null,
    streamUrl: audioUrl,
    isPreview: false,
    previewDuration: null,
    mimeType: "audio/mpeg",
    playable: true,
    needsStreamResolve: false,
    explicit: false,
    externalUrl: item.shareurl || item.shorturl || null,
    license: item.license_ccurl || item.license_ccurl || null,
    playbackType: "authorized_full_stream",
    expiresAt: null,
  };
};

export const mapRadioStation = (item) => {
  const uuid = item.stationuuid || item.uuid;
  if (!uuid) return null;
  const stream = item.url_resolved || item.url || null;
  return {
    id: trackId("radio-browser", uuid),
    provider: "radio-browser",
    providerId: String(uuid),
    type: "radio",
    title: item.name || "Radio Station",
    artist: item.country || item.tags || "Live Radio",
    album: null,
    albumId: null,
    artistId: null,
    imgUrl: pickImage(item.favicon),
    duration: 0,
    audioUrl: stream,
    previewUrl: null,
    streamUrl: stream,
    isPreview: false,
    previewDuration: null,
    mimeType: item.codec ? `audio/${String(item.codec).toLowerCase()}` : null,
    playable: Boolean(stream),
    isLive: true,
    externalUrl: item.homepage || null,
    country: item.country || null,
    tags: item.tags || null,
    bitrate: item.bitrate || null,
    expiresAt: null,
  };
};

export const mapAppleTrack = (item) => {
  if (!item?.trackId && !item?.id) return null;
  const id = item.trackId || item.id;
  const previewUrl = item.previewUrl || null;
  return {
    id: trackId("apple", id),
    provider: "apple",
    providerId: String(id),
    type: "track",
    title: item.trackName || item.title || "Unknown",
    artist: item.artistName || item.artist || "Unknown Artist",
    album: item.collectionName || item.album || null,
    albumId: item.collectionId ? String(item.collectionId) : null,
    artistId: item.artistId ? String(item.artistId) : null,
    imgUrl: pickImage(
      item.artworkUrl100?.replace("100x100", "600x600"),
      item.artworkUrl100,
      item.image,
    ),
    duration: toSeconds(
      item.trackTimeMillis ? item.trackTimeMillis / 1000 : item.duration,
    ),
    audioUrl: previewUrl,
    previewUrl,
    streamUrl: null,
    isPreview: Boolean(previewUrl),
    previewDuration: previewUrl ? 30 : null,
    mimeType: previewUrl ? "audio/mpeg" : null,
    playable: Boolean(previewUrl),
    explicit: item.trackExplicitness === "explicit",
    externalUrl: item.trackViewUrl || item.collectionViewUrl || null,
    expiresAt: null,
  };
};

export const mapAppleAlbum = (item) => {
  if (!item?.collectionId && !item?.id) return null;
  const id = item.collectionId || item.id;
  const art =
    item.artworkUrl600 ||
    item.artworkUrl100?.replace("100x100bb", "600x600bb")?.replace("100x100", "600x600") ||
    item.artworkUrl100;
  return {
    id: `apple:${id}`,
    provider: "apple",
    providerId: String(id),
    type: "album",
    title: item.collectionName || item.title || "Unknown Album",
    artist: item.artistName || item.artist || "Unknown Artist",
    artistId: item.artistId ? String(item.artistId) : null,
    imgUrl: pickImage(art),
    releaseDate: item.releaseDate || item.year || null,
    trackCount: item.trackCount || null,
    externalUrl: item.collectionViewUrl || null,
    playbackCapability: "preview_metadata",
  };
};

export const mapAppleArtist = (item) => {
  if (!item?.artistId && !item?.id) return null;
  const id = item.artistId || item.id;
  const name = item.artistName || item.name || "Unknown Artist";
  return {
    id: `apple:${id}`,
    provider: "apple",
    providerId: String(id),
    type: "artist",
    title: name,
    name,
    imgUrl: pickImage(
      item.artworkUrl100?.replace("100x100bb", "600x600bb"),
      item.artworkUrl100,
      item.image,
    ),
    fans: null,
    albumCount: null,
    externalUrl: item.artistLinkUrl || null,
    playbackCapability: "metadata_only",
  };
};

export const mapAlbum = (item, provider) => {
  if (!item) return null;
  const p = String(provider || item.provider || item.source || "").toLowerCase();

  if (p === "jiosaavn" || item.source === "jiosaavn") {
    if (!item.id) return null;
    return {
      id: `jiosaavn:${item.id}`,
      provider: "jiosaavn",
      providerId: String(item.id),
      type: "album",
      title: decodeHtml(item.name || item.title || "Unknown Album"),
      artist: jioArtistLabel(item.artists) || item.artist || "Unknown Artist",
      imgUrl: pickImage(pickJioImage(item.image), item.image),
      releaseDate: item.year || item.releaseDate || null,
      trackCount: item.songCount || item.nb_tracks || null,
      externalUrl: item.url || item.officialUrl || null,
      language: item.language || null,
      playbackCapability: "full_when_authorized",
    };
  }

  if (p === "apple") {
    return mapAppleAlbum(item);
  }

  // Generic album-shaped payload (never default provider to deezer)
  if (item.type === "album" || item.collectionId) {
    if (p === "deezer" || String(item.provider || "").toLowerCase() === "deezer") {
      return null;
    }
    const id = item.id || item.collectionId;
    if (!id) return null;
    return {
      id: `${p || "unknown"}:${id}`,
      provider: p || "unknown",
      providerId: String(id),
      type: "album",
      title: decodeHtml(item.title || item.name || item.collectionName || "Unknown Album"),
      artist: item.artist?.name || item.artistName || item.artist || "Unknown Artist",
      imgUrl: pickImage(
        item.cover_xl,
        item.cover_big,
        item.cover_medium,
        item.artworkUrl100,
        item.image,
      ),
      releaseDate: item.release_date || item.releaseDate || item.year || null,
      trackCount: item.nb_tracks || item.trackCount || item.tracks?.length || null,
      externalUrl: item.link || item.collectionViewUrl || item.officialUrl || null,
    };
  }

  return null;
};

export const mapArtist = (item, provider) => {
  if (!item) return null;
  const p = String(provider || item.provider || item.source || "").toLowerCase();

  // JioSaavn MUST be checked before any generic type==="artist" branch
  // (Jio payloads often include type:"artist" and would otherwise miss image[]).
  if (p === "jiosaavn" || item.source === "jiosaavn") {
    if (!item.id) return null;
    const name = decodeHtml(item.name || item.title || "Unknown Artist");
    return {
      id: `jiosaavn:${item.id}`,
      provider: "jiosaavn",
      providerId: String(item.id),
      type: "artist",
      title: name,
      name,
      imgUrl: pickImage(pickJioImage(item.image), item.image),
      fans: item.followerCount || null,
      albumCount: null,
      externalUrl: item.url || item.officialUrl || null,
      playbackCapability: "full_when_authorized",
    };
  }

  if (p === "apple") {
    return mapAppleArtist(item);
  }

  if (p === "deezer" || String(item.provider || "").toLowerCase() === "deezer") {
    return null;
  }

  if (item.type === "artist" || item.artistId) {
    const id = item.id || item.artistId;
    if (!id) return null;
    const name = item.name || item.title || item.artistName || "Unknown Artist";
    return {
      id: `${p || "unknown"}:${id}`,
      provider: p || "unknown",
      providerId: String(id),
      type: "artist",
      title: name,
      name,
      imgUrl: pickImage(
        item.picture_xl,
        item.picture_big,
        item.picture_medium,
        pickJioImage(item.image),
        item.artworkUrl100,
        item.image,
      ),
      fans: item.nb_fan || item.followerCount || null,
      albumCount: item.nb_album || null,
      externalUrl: item.link || item.artistLinkUrl || item.officialUrl || null,
    };
  }

  return null;
};

export const mapPlaylist = (item, provider) => {
  if (!item) return null;
  const p = String(provider || item.provider || item.source || "").toLowerCase();
  const id = item.id;

  if (p === "jiosaavn" || item.source === "jiosaavn") {
    if (!id) return null;
    return {
      id: `jiosaavn:${id}`,
      provider: "jiosaavn",
      providerId: String(id),
      type: "playlist",
      title: decodeHtml(item.name || item.title || "Playlist"),
      artist: item.user?.name || item.artist || "JioSaavn",
      description: item.description || null,
      imgUrl: pickImage(pickJioImage(item.image), item.image),
      trackCount: item.songCount || item.nb_tracks || null,
      externalUrl: item.url || item.officialUrl || null,
      language: item.language || null,
      playbackCapability: "full_when_authorized",
    };
  }

  if (p === "deezer" || String(item.provider || "").toLowerCase() === "deezer") {
    return null;
  }

  if (item.type === "playlist") {
    if (!id && !item.officialUrl) return null;
    return {
      id: id ? `${p || "unknown"}:${id}` : `playlist:${item.officialUrl}`,
      provider: p || item.source || "unknown",
      providerId: id ? String(id) : item.officialUrl,
      type: "playlist",
      title: item.title || item.name || "Playlist",
      artist: item.user?.name || item.creator?.name || item.artist || "Playlist",
      description: item.description || null,
      imgUrl: pickImage(
        item.picture_xl,
        item.picture_big,
        item.picture_medium,
        item.image,
      ),
      trackCount: item.nb_tracks || item.songCount || null,
      externalUrl: item.link || item.officialUrl || null,
    };
  }

  if (!id && !item.officialUrl) return null;
  return {
    id: id ? `jiosaavn:${id}` : `jiosaavn:${item.officialUrl || item.title}`,
    provider: "jiosaavn",
    providerId: id ? String(id) : item.officialUrl || item.title,
    type: "playlist",
    title: item.title || item.name || "Playlist",
    artist: item.artist || "JioSaavn",
    description: item.description || null,
    imgUrl: pickImage(pickJioImage(item.image), item.image),
    trackCount: item.songCount || null,
    externalUrl: item.officialUrl || null,
    language: item.language || null,
  };
};

export const mapPodcast = (item) => {
  if (!item?.id) return null;
  return {
    id: `deezer:${item.id}`,
    provider: "deezer",
    providerId: String(item.id),
    type: "podcast",
    title: item.title || "Podcast",
    artist: "Podcast",
    description: item.description || null,
    imgUrl: pickImage(
      item.picture_xl,
      item.picture_big,
      item.picture_medium,
      item.picture,
    ),
    externalUrl: item.link || null,
    fans: item.fans || null,
  };
};

/** Deezer radios removed — never emit entities. */
export const mapDeezerRadio = () => null;

export const mapTracks = (items, mapper) =>
  asArray(items)
    .map(mapper)
    .filter(Boolean);

export const mapAlbums = (items, provider) =>
  asArray(items)
    .map((item) => mapAlbum(item, provider))
    .filter(Boolean);

export const mapArtists = (items, provider) =>
  asArray(items)
    .map((item) => mapArtist(item, provider))
    .filter(Boolean);

export const mapPlaylists = (items, provider) =>
  asArray(items)
    .map((item) => mapPlaylist(item, provider))
    .filter(Boolean);

export const normalizePlayableTrack = (track) => {
  if (!track) return null;
  const provider = String(track.provider || "").toLowerCase();
  if (provider === "deezer" || provider.startsWith("deezer")) return null;
  const audio = String(track.audioUrl || track.streamUrl || track.previewUrl || "");
  if (/dzcdn\.net|deezer\.com/i.test(audio)) return null;
  return {
    _id: track.id,
    id: track.id,
    provider: track.provider,
    providerId: track.providerId,
    type: track.type || "track",
    title: track.title,
    artist: track.artist,
    album: track.album || null,
    albumId: track.albumId || null,
    artistId: track.artistId || null,
    imgUrl: track.imgUrl || PLACEHOLDER_ART,
    audioUrl: track.audioUrl || track.streamUrl || track.previewUrl || "",
    duration: track.duration || 0,
    isPreview: Boolean(track.isPreview),
    previewDuration: track.previewDuration ?? null,
    mimeType: track.mimeType || null,
    playable: Boolean(track.playable && (track.audioUrl || track.streamUrl || track.previewUrl || track.needsStreamResolve)),
    needsStreamResolve: Boolean(track.needsStreamResolve),
    isLive: Boolean(track.isLive),
    explicit: Boolean(track.explicit),
    externalUrl: track.externalUrl || null,
    expiresAt: track.expiresAt || null,
    source: "external",
  };
};

export { asArray, PLACEHOLDER_ART, pickImage, toSeconds };
