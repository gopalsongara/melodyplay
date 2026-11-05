import express from "express";
import { clerkMiddleware } from "@clerk/express";
import fileUpload from "express-fileupload";
import path from "path";
import cors from "cors";
import cron from "node-cron";
import fs from "fs";

import { corsOriginCallback } from "./lib/corsOrigins.js";
import { getJioSaavnBaseUrl } from "./services/music/jiosaavn.client.js";
import {
  listProviderCapabilities,
  getJioSaavnAuthorizationStatus,
  canAttemptJioSaavnFullPlayback,
} from "./services/music/providerCapabilities.js";
import {
  musicDiscoveryLimiter,
  libraryWriteLimiter,
} from "./middleware/rateLimit.js";
import userRoutes from "./routes/user.route.js";
import authRoutes from "./routes/auth.route.js";
import adminRoutes from "./routes/admin.route.js";
import songRoutes from "./routes/song.route.js";
import albumRoutes from "./routes/album.route.js";
import statsRoutes from "./routes/stat.route.js";
import searchRoutes from "./routes/search.route.js";
import musicRoutes from "./routes/music.route.js";
import libraryRoutes from "./routes/library.route.js";

const __dirname = path.resolve();

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: corsOriginCallback,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      optionsSuccessStatus: 204,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV === "test") {
    // Avoid Clerk network/key validation during unit/integration tests
    app.use((req, _res, next) => {
      req.auth = () => ({ userId: null });
      next();
    });
  } else {
    app.use(clerkMiddleware());
  }
  app.use(
    fileUpload({
      useTempFiles: true,
      tempFileDir: path.join(__dirname, "tmp"),
      createParentPath: true,
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  );

  const tempDir = path.join(process.cwd(), "tmp");
  if (process.env.NODE_ENV !== "test") {
    cron.schedule("0 * * * *", () => {
      if (fs.existsSync(tempDir)) {
        fs.readdir(tempDir, (err, files) => {
          if (err) return;
          for (const file of files) {
            fs.unlink(path.join(tempDir, file), () => {});
          }
        });
      }
    });
  }

  app.get("/api/health", async (_req, res) => {
    const jiosaavnBase = getJioSaavnBaseUrl();
    const jiosaavnHealthUrl = `${String(jiosaavnBase).replace(/\/$/, "")}/health`;
    let jiosaavn = { ok: false, baseUrl: jiosaavnBase };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(jiosaavnHealthUrl, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      jiosaavn = {
        ok: response.ok || response.status < 500,
        baseUrl: jiosaavnBase,
        healthUrl: jiosaavnHealthUrl,
        status: response.status,
      };
    } catch (error) {
      jiosaavn = {
        ok: false,
        baseUrl: jiosaavnBase,
        healthUrl: jiosaavnHealthUrl,
        error: error?.name === "AbortError" ? "timeout" : "unreachable",
      };
    }

    const warnings = [];
    if (!jiosaavn.ok) {
      warnings.push(
        "JioSaavn sidecar unreachable — song search falls back to Audius/Jamendo full streams only",
      );
    }
    if (!canAttemptJioSaavnFullPlayback()) {
      warnings.push(
        "JioSaavn full-track upgrades disabled (set JIOSAAVN_AUTHORIZED=true only after legal attestation)",
      );
    } else if (getJioSaavnAuthorizationStatus() === "unverified_dev_only") {
      warnings.push(
        "JioSaavn full-track upgrades allowed in development only — authorization unverified for production",
      );
    }

    const localhostSidecar =
      /localhost|127\.0\.0\.1/i.test(jiosaavnBase) &&
      process.env.NODE_ENV === "production";
    if (localhostSidecar) {
      warnings.push(
        "JIOSAAVN_API_BASE_URL points at localhost — Airtel Cloud / Render cannot reach your laptop; use the cloud Jio URL",
      );
    }

    res.json({
      success: true,
      data: {
        status: "ok",
        service: "melodyplay-api",
        time: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV || "development",
        providers: {
          jiosaavn: {
            ...jiosaavn,
            authorizationStatus: getJioSaavnAuthorizationStatus(),
            fullPlaybackAttemptAllowed: canAttemptJioSaavnFullPlayback(),
          },
          sayaConfigured: Boolean(process.env.SAYA_API_BASE_URL),
          capabilities: listProviderCapabilities(),
        },
        warnings,
      },
    });
  });

  app.use("/api/music", musicDiscoveryLimiter);
  app.use("/api/search", musicDiscoveryLimiter);

  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/songs", songRoutes);
  app.use("/api/albums", albumRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/music", musicRoutes);

  app.use("/api/library", (req, res, next) => {
    if (req.method === "GET") return next();
    return libraryWriteLimiter(req, res, next);
  });
  app.use("/api/library", libraryRoutes);

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "../frontend", "dist", "index.html"));
    });
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      success: false,
      message:
        process.env.NODE_ENV === "production" && status === 500
          ? "Internal Server Error"
          : err.message,
    });
  });

  return app;
};
