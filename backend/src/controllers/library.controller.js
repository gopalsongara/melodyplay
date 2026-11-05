import { Favorite } from "../models/favorite.model.js";
import { History } from "../models/history.model.js";
import { UserPlaylist } from "../models/userPlaylist.model.js";
import { getAuthUserId } from "../middleware/auth.middleware.js";
import {
  isUntrustedCatalogueTrack,
  sanitizePersistedTrack,
} from "../services/music/legacyTrackPolicy.js";

const getUserId = (req) => getAuthUserId(req);

const trackPayload = (body = {}) => {
  const rawId = body.trackId || body.id || body._id || "";
  const provider =
    body.provider ||
    (typeof rawId === "string" && rawId.includes(":")
      ? rawId.split(":")[0]
      : "unknown");
  const providerId =
    body.providerId ||
    (typeof rawId === "string" && rawId.includes(":")
      ? rawId.split(":").slice(1).join(":")
      : String(rawId || ""));

  return {
    provider,
    providerId: String(providerId || rawId || "unknown"),
    trackId: String(rawId || `${provider}:${providerId}`),
    title: body.title || "Unknown",
    artist: body.artist || "Unknown Artist",
    album:
      typeof body.album === "string"
        ? body.album
        : body.album?.name || body.album?.title || null,
    imgUrl: body.imgUrl || "",
    audioUrl: body.audioUrl || "",
    duration: Number(body.duration) || 0,
    isPreview: Boolean(body.isPreview),
    mimeType: body.mimeType || null,
    externalUrl: body.externalUrl || null,
  };
};

const withPlaybackAvailability = (row) => {
  if (!row) return row;
  const obj = typeof row.toObject === "function" ? row.toObject() : { ...row };
  const blocked = isUntrustedCatalogueTrack(obj);
  return {
    ...obj,
    playbackAvailable: !blocked,
    blockedReason: blocked
      ? "Legacy or blocked provider — kept in library but not playable"
      : null,
  };
};

export const listFavorites = async (req, res, next) => {
  try {
    const favorites = await Favorite.find({ userId: getUserId(req) }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      data: favorites.map(withPlaybackAvailability),
    });
  } catch (error) {
    next(error);
  }
};

export const addFavorite = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const payload = trackPayload(req.body);
    if (!payload.trackId || !payload.title || !payload.provider) {
      return res.status(400).json({
        success: false,
        message: "provider, trackId/title required",
      });
    }

    // Keep library rows for history, but refuse new Deezer / Songs.PK favorites
    if (isUntrustedCatalogueTrack(payload)) {
      return res.status(403).json({
        success: false,
        message:
          "Blocked or unverified legacy sources cannot be added to Liked Songs",
      });
    }

    const favorite = await Favorite.findOneAndUpdate(
      { userId, trackId: payload.trackId },
      { ...payload, userId, snapshot: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    next(error);
  }
};

export const removeFavorite = async (req, res, next) => {
  try {
    await Favorite.findOneAndDelete({
      userId: getUserId(req),
      trackId: req.params.trackId,
    });
    res.json({ success: true, message: "Removed from favorites" });
  } catch (error) {
    next(error);
  }
};

export const listHistory = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const history = await History.find({ userId: getUserId(req) })
      .sort({ playedAt: -1 })
      .limit(limit);
    // Keep rows intact but mark blocked providers; client must not autoplay them
    res.json({
      success: true,
      data: history
        .map(withPlaybackAvailability)
        .filter((row) => sanitizePersistedTrack(row) || row.playbackAvailable === false),
    });
  } catch (error) {
    next(error);
  }
};

export const addHistory = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const payload = trackPayload(req.body);
    if (!payload.trackId || !payload.title) {
      return res.status(400).json({ success: false, message: "Invalid track" });
    }

    // Keep one recent entry per track; bump playedAt
    const entry = await History.findOneAndUpdate(
      { userId, trackId: payload.trackId },
      { ...payload, userId, playedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Cap history size
    const extras = await History.find({ userId })
      .sort({ playedAt: -1 })
      .skip(100)
      .select("_id");
    if (extras.length) {
      await History.deleteMany({ _id: { $in: extras.map((e) => e._id) } });
    }

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

export const clearHistory = async (req, res, next) => {
  try {
    await History.deleteMany({ userId: getUserId(req) });
    res.json({ success: true, message: "History cleared" });
  } catch (error) {
    next(error);
  }
};

export const listUserPlaylists = async (req, res, next) => {
  try {
    const playlists = await UserPlaylist.find({ userId: getUserId(req) }).sort({
      updatedAt: -1,
    });
    res.json({ success: true, data: playlists });
  } catch (error) {
    next(error);
  }
};

export const createUserPlaylist = async (req, res, next) => {
  try {
    const { title, description = "", imgUrl = "" } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "title required" });
    }
    const playlist = await UserPlaylist.create({
      userId: getUserId(req),
      title: title.trim(),
      description,
      imgUrl,
      tracks: [],
    });
    res.status(201).json({ success: true, data: playlist });
  } catch (error) {
    next(error);
  }
};

export const getUserPlaylist = async (req, res, next) => {
  try {
    const playlist = await UserPlaylist.findOne({
      _id: req.params.id,
      userId: getUserId(req),
    });
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, data: playlist });
  } catch (error) {
    next(error);
  }
};

export const addTrackToPlaylist = async (req, res, next) => {
  try {
    const playlist = await UserPlaylist.findOne({
      _id: req.params.id,
      userId: getUserId(req),
    });
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const track = trackPayload(req.body);
    if (!track.trackId || !track.title) {
      return res.status(400).json({ success: false, message: "Invalid track" });
    }

    const exists = playlist.tracks.some((t) => t.trackId === track.trackId);
    if (!exists) {
      playlist.tracks.push(track);
      if (!playlist.imgUrl && track.imgUrl) playlist.imgUrl = track.imgUrl;
      await playlist.save();
    }

    res.json({ success: true, data: playlist });
  } catch (error) {
    next(error);
  }
};

export const removeTrackFromPlaylist = async (req, res, next) => {
  try {
    const playlist = await UserPlaylist.findOne({
      _id: req.params.id,
      userId: getUserId(req),
    });
    if (!playlist) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    playlist.tracks = playlist.tracks.filter(
      (t) => t.trackId !== req.params.trackId,
    );
    await playlist.save();
    res.json({ success: true, data: playlist });
  } catch (error) {
    next(error);
  }
};

export const deleteUserPlaylist = async (req, res, next) => {
  try {
    await UserPlaylist.findOneAndDelete({
      _id: req.params.id,
      userId: getUserId(req),
    });
    res.json({ success: true, message: "Playlist deleted" });
  } catch (error) {
    next(error);
  }
};
