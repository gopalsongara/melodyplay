import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
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
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

historySchema.index({ userId: 1, playedAt: -1 });
historySchema.index({ userId: 1, trackId: 1 });

export const History = mongoose.model("History", historySchema);
