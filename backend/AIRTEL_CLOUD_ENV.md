# MelodyPlay API — Airtel Cloud / production env

Laptop pe Jio sidecar **mat** chalao production ke liye. Cloud Jio URL use karo taaki restart / deploy ke baad bhi catalog na toote.

## Required env vars (Airtel Cloud dashboard)

```bash
NODE_ENV=production
PORT=8080

MONGODB_URI=<your-atlas-uri>
CLERK_PUBLISHABLE_KEY=<pk_...>
CLERK_SECRET_KEY=<sk_...>
CORS_ORIGIN=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com

# Full Indian catalog — MUST be public HTTPS (not localhost)
JIOSAAVN_API_BASE_URL=https://shnwazdev-jiosaavn-apii.vercel.app
JIOSAAVN_AUTHORIZED=true
JIOSAAVN_API_TIMEOUT_MS=35000
JIOSAAVN_API_RETRIES=3

SAYA_API_BASE_URL=https://sayamusicapi.sayaproject-mailflow.workers.dev
JAMENDO_CLIENT_ID=<your-jamendo-client-id>
JAMENDO_CLIENT_SECRET=<optional>
```

## Why this does not fail on laptop restart

| Setting | Effect |
|---------|--------|
| `JIOSAAVN_API_BASE_URL` = Vercel cloud | Catalog lives outside your PC |
| `JIOSAAVN_AUTHORIZED=true` | Production full-stream path enabled |
| Production localhost block | Code ignores `localhost:3099` when `NODE_ENV=production` |
| Longer timeout + retries | Survives serverless cold starts |

## After deploy — smoke test

```bash
curl https://YOUR-AIRTEL-API/api/health
curl "https://YOUR-AIRTEL-API/api/music/search?q=alfaz&limit=3"
```

Expect: `jiosaavn.ok: true` and tracks with `provider: "jiosaavn"`.

## Optional: own Jio sidecar

Agar public Vercel instance slow/down ho, apna fork deploy karo (Vercel/Render) aur `JIOSAAVN_API_BASE_URL` us URL pe point karo. Kabhi bhi production mein `http://localhost:3099` mat set karna.
