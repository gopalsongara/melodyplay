import { SayaApiError } from "../services/music/saya.client.js";
import { JioSaavnApiError } from "../services/music/jiosaavn.client.js";
import * as searchService from "../services/music/musicSearch.service.js";
import * as detailsService from "../services/music/musicDetails.service.js";
import * as streamService from "../services/music/musicStream.service.js";
import * as discoveryService from "../services/music/musicDiscovery.service.js";
import * as radioService from "../services/music/musicRadio.service.js";
import * as lyricsService from "../services/music/musicLyrics.service.js";

const handle = (fn) => async (req, res, next) => {
  try {
    const data = await fn(req, res);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof SayaApiError || error instanceof JioSaavnApiError) {
      return res.status(error.status || 502).json({
        success: false,
        message: error.message,
        details: error.details || undefined,
      });
    }
    next(error);
  }
};

const requireQuery = (value, name) => {
  if (!value || !String(value).trim()) {
    throw new SayaApiError(`${name} is required`, { status: 400 });
  }
  return String(value).trim();
};

export const searchAll = handle(async (req) => {
  const q = req.query.q ? String(req.query.q).trim() : "";
  if (q.length > 0 && q.length < 1) {
    throw new SayaApiError("Search query is empty", { status: 400 });
  }
  return searchService.universalSearch({
    q,
    limit: Number(req.query.limit) || 12,
    types: req.query.types || "tracks,albums,artists,playlists",
  });
});

export const searchTracks = handle(async (req) =>
  searchService.searchTracks({
    q: requireQuery(req.query.q, "q"),
    limit: Number(req.query.limit) || 20,
    offset: Number(req.query.offset) || 0,
    // Full streams only — never Apple/Deezer 30s previews as song rows
    providers: req.query.providers || "jiosaavn,audius,jamendo",
  }),
);

export const upgradeFull = handle(async (req) => {
  const track = req.body || {};
  if (!track.title) {
    throw new SayaApiError("title is required", { status: 400 });
  }
  const upgraded = await streamService.upgradeToFullTrack(track);
  return {
    track: upgraded,
    upgraded: Boolean(upgraded),
  };
});

export const searchAlbums = handle(async (req) =>
  searchService.searchAlbums({
    q: requireQuery(req.query.q, "q"),
    limit: Number(req.query.limit) || 20,
    providers: req.query.providers || "jiosaavn,audius",
  }),
);

export const searchArtists = handle(async (req) =>
  searchService.searchArtists({
    q: requireQuery(req.query.q, "q"),
    limit: Number(req.query.limit) || 20,
    providers: req.query.providers || "jiosaavn,audius",
  }),
);

export const searchPlaylists = handle(async (req) =>
  searchService.searchPlaylists({
    q: requireQuery(req.query.q, "q"),
    limit: Number(req.query.limit) || 20,
  }),
);

export const searchPodcasts = handle(async (req) =>
  searchService.searchPodcasts({
    q: requireQuery(req.query.q, "q"),
    limit: Number(req.query.limit) || 20,
  }),
);

export const autocomplete = handle(async (req) =>
  searchService.autocomplete({
    q: requireQuery(req.query.q, "q"),
    limit: Number(req.query.limit) || 8,
  }),
);

export const matchTrack = handle(async (req) =>
  searchService.matchTrack({
    artist: requireQuery(req.query.artist, "artist"),
    title: requireQuery(req.query.title, "title"),
  }),
);

export const getTrack = handle(async (req) =>
  detailsService.getTrackDetails({
    provider: req.params.provider,
    id: req.params.id,
  }),
);

export const getAlbum = handle(async (req) =>
  detailsService.getAlbumDetails({
    provider: req.params.provider,
    id: req.params.id,
  }),
);

export const getArtist = handle(async (req) =>
  detailsService.getArtistDetails({
    provider: req.params.provider,
    id: req.params.id,
  }),
);

export const getPlaylist = handle(async (req) =>
  detailsService.getPlaylistDetails({
    provider: req.params.provider,
    id: req.params.id,
  }),
);

export const getPodcast = handle(async (req) =>
  detailsService.getPodcastDetails({ id: req.params.id }),
);

export const getRelated = handle(async (req) =>
  detailsService.getRelatedTracks({
    provider: req.params.provider || req.query.provider || "jiosaavn",
    id: req.params.id || req.query.id,
    artist: req.query.artist,
    title: req.query.title,
  }),
);

export const resolveLinks = handle(async (req) =>
  detailsService.resolveExternalLinks({
    url: requireQuery(req.query.url, "url"),
  }),
);

export const getStream = handle(async (req) =>
  streamService.resolveStream({
    source: requireQuery(req.query.source || req.params.provider, "source"),
    id: req.query.id || req.params.id,
    uuid: req.query.uuid,
  }),
);

export const getPreview = handle(async (req) =>
  streamService.resolvePreview({
    source: requireQuery(req.query.source, "source"),
    id: requireQuery(req.query.id, "id"),
  }),
);

export const getQuality = handle(async (req) =>
  streamService.getMediaQuality({
    source: req.query.source,
    id: req.query.id,
    uuid: req.query.uuid,
  }),
);

export const getArtwork = handle(async (req) =>
  streamService.resolveArtwork({
    source: req.query.source,
    id: req.query.id,
    releaseId: req.query.releaseId,
  }),
);

export const getHome = handle(async (req) =>
  discoveryService.getHomeDiscovery({
    seeds: req.query.seeds || req.body?.seeds || [],
  }),
);

export const getPersonalized = handle(async (req) =>
  discoveryService.getPersonalizedDiscovery({
    seeds: req.query.seeds || req.body?.seeds || [],
    limit: Number(req.query.limit) || 12,
  }),
);

export const getCharts = handle(async (req) =>
  discoveryService.getCharts({ limit: Number(req.query.limit) || 20 }),
);

export const getTrending = handle(async (req) =>
  discoveryService.getTrending({ limit: Number(req.query.limit) || 20 }),
);

export const getGenres = handle(async () => discoveryService.getGenres());

export const getGenre = handle(async (req) =>
  discoveryService.getGenreTracks({
    genre: req.params.genre || req.query.q,
    limit: Number(req.query.limit) || 20,
  }),
);

export const getLyrics = handle(async (req) =>
  lyricsService.getLyrics({
    provider: req.query.provider || req.params.provider,
    id: req.query.id || req.params.id,
    artist: req.query.artist,
    title: req.query.title,
  }),
);

export const searchRadio = handle(async (req) =>
  radioService.searchStations({
    q: req.query.q,
    tag: req.query.tag,
    country: req.query.country,
    limit: Number(req.query.limit) || 20,
  }),
);

export const topRadio = handle(async (req) =>
  radioService.getTopStations({ limit: Number(req.query.limit) || 20 }),
);

export const radioTags = handle(async () => radioService.getRadioTags());

export const radioCountries = handle(async () =>
  radioService.getRadioCountries(),
);

export const radioStream = handle(async (req) =>
  radioService.getStationStream({ uuid: requireQuery(req.params.uuid, "uuid") }),
);

