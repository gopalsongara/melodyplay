import { sayaRequest, SayaApiError } from "./saya.client.js";
import {
  mapRadioStation,
  asArray,
  normalizePlayableTrack,
} from "./music.mapper.js";
import { resolveStream } from "./musicStream.service.js";

export const searchStations = async ({
  q,
  tag,
  country,
  limit = 20,
} = {}) => {
  let res;

  if (tag) {
    res = await sayaRequest("/v1/radio-browser/stations/by-tag", {
      params: { tag, limit },
      cache: true,
    });
  } else if (country) {
    res = await sayaRequest("/v1/radio-browser/stations/by-country", {
      params: { country, limit },
      cache: true,
    });
  } else if (q) {
    res = await sayaRequest("/v1/radio-browser/stations/search", {
      params: { name: q, limit },
      cache: true,
    });
  } else {
    res = await sayaRequest("/v1/radio-browser/stations/top-vote", {
      params: { limit },
      cache: true,
    });
  }

  const stations = asArray(res?.data)
    .map(mapRadioStation)
    .filter(Boolean)
    .map(normalizePlayableTrack);

  return { stations, total: stations.length };
};

export const getTopStations = async ({ limit = 20 } = {}) => {
  const res = await sayaRequest("/v1/radio-browser/stations/top-vote", {
    params: { limit },
    cache: true,
  });
  const stations = asArray(res?.data)
    .map(mapRadioStation)
    .filter(Boolean)
    .map(normalizePlayableTrack);
  return { stations };
};

export const getRadioTags = async () => {
  const res = await sayaRequest("/v1/radio-browser/lists/tags", {
    params: { order: "stationcount", reverse: true, limit: 40 },
    cache: true,
  });
  return {
    tags: asArray(res?.data).slice(0, 40),
  };
};

export const getRadioCountries = async () => {
  const res = await sayaRequest("/v1/radio-browser/lists/countries", {
    cache: true,
  });
  return { countries: asArray(res?.data).slice(0, 80) };
};

export const getStationStream = async ({ uuid }) => {
  if (!uuid) throw new SayaApiError("uuid is required", { status: 400 });
  return resolveStream({ source: "radio-browser", uuid });
};
