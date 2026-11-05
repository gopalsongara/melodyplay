const audiusSearch = async () => {
  const url =
    "https://api.audius.co/v1/tracks/search?query=Believer&app_name=MelodyPlay&limit=5";
  const res = await fetch(url);
  const json = await res.json();
  const tracks = json.data || [];
  console.log("AUDIUS_SEARCH", tracks.length);
  for (const t of tracks.slice(0, 3)) {
    console.log("-", t.id, t.title, t.user?.name, t.duration);
  }
  if (!tracks[0]) return;
  const stream = await fetch(
    `https://api.audius.co/v1/tracks/${tracks[0].id}/stream?app_name=MelodyPlay`,
    { redirect: "manual" },
  );
  console.log(
    "AUDIUS_STREAM",
    stream.status,
    stream.headers.get("location")?.slice(0, 100) ||
      stream.headers.get("content-type"),
  );
};

const jamendo = async () => {
  const id = process.env.JAMENDO_CLIENT_ID || "missing";
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${id}&format=json&limit=2&namesearch=love&include=musicinfo`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(
    "JAMENDO",
    json.headers?.status,
    json.headers?.error_message || "",
    "results=",
    json.results?.length || 0,
  );
  if (json.results?.[0]) {
    const t = json.results[0];
    console.log("-", t.name, t.artist_name, t.duration, Boolean(t.audio));
  }
};

const sayaAudius = async () => {
  const base =
    process.env.SAYA_API_BASE_URL ||
    "https://sayamusicapi.sayaproject-mailflow.workers.dev";
  const res = await fetch(
    `${base}/v1/audius/search/tracks?q=Believer&limit=3`,
  );
  console.log("SAYA_AUDIUS_HTTP", res.status);
  const json = await res.json();
  const list = json?.data?.data || json?.data || [];
  console.log("SAYA_AUDIUS_COUNT", Array.isArray(list) ? list.length : 0);
};

await audiusSearch();
await jamendo();
await sayaAudius();
