import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    trackId: {
      type: String,
      required: true,
    },
    title: { type: String, required: true, default: "Unknown" },
    artist: { type: String, required: true, default: "Unknown Artist" },
    album: { type: String, default: null },
    imgUrl: { type: String, default: "" },
    audioUrl: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false },
    mimeType: { type: String, default: null },
    externalUrl: { type: String, default: null },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

favoriteSchema.index({ userId: 1, trackId: 1 }, { unique: true });

export const Favorite = mongoose.model("Favorite", favoriteSchema);
