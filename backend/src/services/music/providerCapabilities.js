/**
 * Provider capability + authorization model.
 * "Available" ≠ "authorized for commercial full-track redistribution".
 * Deezer is removed from the active MelodyPlay provider set.
 */

import { isProviderAllowed } from "./providerRegistry.js";

export const PROVIDER_CAPABILITIES = {
  apple: {
    providerName: "apple",
    supportsFullPlayback: false,
    supportsPreview: true,
    supportsSeeking: true,
    requiresAuthentication: false,
    authorizationStatus: "preview_api_via_saya",
    notes: "iTunes search preview URLs only (~30s).",
  },
  audius: {
    providerName: "audius",
    supportsFullPlayback: true,
    supportsPreview: false,
    supportsSeeking: true,
    requiresAuthentication: false,
    authorizationStatus: "open_platform_via_saya",
    notes: "Audius tracks are typically fully streamable via Saya media/stream.",
  },
  jamendo: {
    providerName: "jamendo",
    supportsFullPlayback: true,
    supportsPreview: false,
    supportsSeeking: true,
    requiresAuthentication: false,
    authorizationStatus: "creative_commons_api",
    notes:
      "Jamendo CC catalog — full streams when JAMENDO_CLIENT_ID is configured (developer.jamendo.com).",
  },
  jiosaavn: {
    providerName: "jiosaavn",
    supportsFullPlayback: true,
    supportsPreview: false,
    supportsSeeking: true,
    requiresAuthentication: false,
    authorizationStatus: "operator_attestation_required",
    notes:
      "Local/community sidecar adapters exist for development. Do not enable in production without JIOSAAVN_AUTHORIZED=true and a public secured sidecar URL.",
  },
  "radio-browser": {
    providerName: "radio-browser",
    supportsFullPlayback: true,
    supportsPreview: false,
    supportsSeeking: false,
    requiresAuthentication: false,
    authorizationStatus: "public_radio_streams",
    notes: "Live radio station streams via Radio Browser.",
  },
  archive: {
    providerName: "archive",
    supportsFullPlayback: true,
    supportsPreview: false,
    supportsSeeking: true,
    requiresAuthentication: false,
    authorizationStatus: "via_saya_when_available",
    notes: "Internet Archive items when exposed by Saya.",
  },
  musicbrainz: {
    providerName: "musicbrainz",
    supportsFullPlayback: false,
    supportsPreview: false,
    supportsSeeking: false,
    requiresAuthentication: false,
    authorizationStatus: "metadata_only",
    notes: "Artist/release-group metadata for discography enrichment. No streams.",
  },
};

export const canAttemptJioSaavnFullPlayback = () => {
  if (String(process.env.JIOSAAVN_AUTHORIZED).toLowerCase() === "false") {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    return String(process.env.JIOSAAVN_AUTHORIZED).toLowerCase() === "true";
  }
  return true;
};

export const getJioSaavnAuthorizationStatus = () => {
  if (String(process.env.JIOSAAVN_AUTHORIZED).toLowerCase() === "true") {
    return "explicitly_attested_by_operator";
  }
  if (process.env.NODE_ENV === "production") {
    return "disabled_until_attested";
  }
  return "unverified_dev_only";
};

export const listProviderCapabilities = () =>
  Object.values(PROVIDER_CAPABILITIES)
    .filter((cap) => isProviderAllowed(cap.providerName))
    .map((cap) => {
      if (cap.providerName === "jiosaavn") {
        return {
          ...cap,
          authorizationStatus: getJioSaavnAuthorizationStatus(),
          fullPlaybackAttemptAllowed: canAttemptJioSaavnFullPlayback(),
        };
      }
      return {
        ...cap,
        fullPlaybackAttemptAllowed: Boolean(cap.supportsFullPlayback),
      };
    });

export const getProviderCapability = (provider) => {
  const key = String(provider || "").toLowerCase();
  if (!isProviderAllowed(key)) {
    return {
      providerName: key || "unknown",
      supportsFullPlayback: false,
      supportsPreview: false,
      supportsSeeking: false,
      requiresAuthentication: false,
      authorizationStatus: "removed",
      fullPlaybackAttemptAllowed: false,
      notes: "Provider removed from MelodyPlay (e.g. Deezer)",
    };
  }
  return (
    listProviderCapabilities().find((p) => p.providerName === key) || {
      providerName: key || "unknown",
      supportsFullPlayback: false,
      supportsPreview: false,
      supportsSeeking: false,
      requiresAuthentication: false,
      authorizationStatus: "unknown",
      fullPlaybackAttemptAllowed: false,
      notes: "Unrecognized provider",
    }
  );
};
