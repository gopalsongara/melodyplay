import dotenv from "dotenv";
import { createServer } from "http";
import { connectDB } from "./lib/db.js";
import { initializeSocket } from "./lib/socket.js";
import { getAllowedOrigins } from "./lib/corsOrigins.js";
import {
  getJioSaavnBaseUrl,
  JIOSAAVN_CLOUD_DEFAULT,
} from "./services/music/jiosaavn.client.js";
import { canAttemptJioSaavnFullPlayback } from "./services/music/providerCapabilities.js";
import { createApp } from "./app.js";

const dotenvResult = dotenv.config();
// Prefer PORT from .env so a shell leftover like JioSaavn PORT=3099 cannot steal the API port
const PORT =
  Number(dotenvResult.parsed?.PORT) || Number(process.env.PORT) || 8080;

const app = createApp();
const httpServer = createServer(app);
initializeSocket(httpServer);

const server = httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT} (0.0.0.0)`);
  console.log(`CORS allow-list: ${getAllowedOrigins().join(", ")}`);
  connectDB();

  const jiosaavnBase = getJioSaavnBaseUrl();
  const isProd =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";

  if (isProd) {
    if (!canAttemptJioSaavnFullPlayback()) {
      console.error(
        "[providers] FATAL for full catalog: set JIOSAAVN_AUTHORIZED=true on Airtel Cloud / production",
      );
    }
    if (/localhost|127\.0\.0\.1/i.test(jiosaavnBase)) {
      console.error(
        `[providers] Refusing localhost Jio URL in production — using ${JIOSAAVN_CLOUD_DEFAULT}`,
      );
    }
  }

  // Prefer /health — cloud hosts may return 5xx on bare "/"
  const jiosaavnHealth = `${jiosaavnBase.replace(/\/$/, "")}/health`;
  fetch(jiosaavnHealth)
    .then((r) => {
      if (!r.ok && r.status >= 500) {
        console.warn(
          `[providers] JioSaavn sidecar unhealthy at ${jiosaavnBase} (${r.status}) — catalog may degrade`,
        );
      } else {
        console.log(`[providers] JioSaavn sidecar reachable at ${jiosaavnBase}`);
      }
    })
    .catch(() => {
      console.warn(
        `[providers] JioSaavn sidecar UNREACHABLE at ${jiosaavnBase} — song search uses Audius/Jamendo full streams only (no 30s previews)`,
      );
    });
});

const shutdown = (signal) => {
  console.log(`[shutdown] ${signal} received — closing HTTP server`);
  server.close(() => {
    console.log("[shutdown] HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
