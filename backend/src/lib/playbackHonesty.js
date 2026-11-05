/**
 * Ensure preview clips never carry full-catalog durations in API payloads.
 */
export const withHonestPlaybackDuration = (track = {}, { isPreview, previewDuration = 30 } = {}) => {
  const preview = Boolean(isPreview ?? track.isPreview);
  if (!preview) {
    return {
      ...track,
      isPreview: false,
      previewDuration: track.previewDuration ?? null,
    };
  }
  const clip = Number(previewDuration || track.previewDuration) || 30;
  return {
    ...track,
    isPreview: true,
    previewDuration: clip,
    duration: clip,
  };
};
