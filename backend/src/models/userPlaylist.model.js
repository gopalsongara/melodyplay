import mongoose from "mongoose";

const playlistTrackSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
    trackId: { type: String, required: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album: { type: String, default: null },
    imgUrl: { type: String, default: "" },
    audioUrl: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false },
    mimeType: { type: String, default: null },
    externalUrl: { type: String, default: null },
  },
  { _id: false },
);

const userPlaylistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    imgUrl: { type: String, default: "" },
    tracks: { type: [playlistTrackSchema], default: [] },
  },
  { timestamps: true },
);

export const UserPlaylist = mongoose.model("UserPlaylist", userPlaylistSchema);
