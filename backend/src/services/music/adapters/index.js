import { appleAdapter } from "./apple.adapter.js";
import { musicbrainzAdapter } from "./musicbrainz.adapter.js";
import { isProviderAllowed } from "../providerRegistry.js";
import { PlaybackType } from "./providerAdapter.js";

/**
 * Thin wrappers over existing clients that already live in MelodyPlay.
 * Full search orchestration still uses musicSearch.service for aggregation.
 */
export const ADAPTERS = {
  apple: appleAdapter,
  musicbrainz: musicbrainzAdapter,
};

export const listAdapterCapabilities = () =>
  Object.values(ADAPTERS)
    .filter((a) => isProviderAllowed(a.name))
    .map((a) => ({
      providerName: a.name,
      ...a.capabilities,
    }));

export { PlaybackType, appleAdapter, musicbrainzAdapter };
