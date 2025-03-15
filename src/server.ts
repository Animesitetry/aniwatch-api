import https from "https";
import { config } from "dotenv";
import corsConfig from "./config/cors.js";
import { ratelimit } from "./config/ratelimit.js";
import {
  cacheConfigSetter,
  cacheControlMiddleware,
} from "./middleware/cache.js";
import { hianimeRouter } from "./routes/hianime.js";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import pkgJson from "../package.json" with { type: "json" };
import { errorHandler, notFoundHandler } from "./config/errorHandler.js";
import type { AniwatchAPIVariables } from "./config/variables.js";

config();

const BASE_PATH = "/api/v2" as const;
const PORT = process.env.PORT || 3000;
const ANIWATCH_API_HOSTNAME = process.env.ANIWATCH_API_HOSTNAME;

const app = new Hono<{ Variables: AniwatchAPIVariables }>();

app.use(logger());
app.use(corsConfig);
app.use(cacheControlMiddleware);

const ISNT_PERSONAL_DEPLOYMENT = Boolean(ANIWATCH_API_HOSTNAME);
if (ISNT_PERSONAL_DEPLOYMENT) {
  app.use(ratelimit);
}

app.use("/", serveStatic({ root: "public" }));
app.get("/health", (c) => c.text("daijoubu", { status: 200 }));
app.get("/v", async (c) =>
  c.text(`v${"version" in pkgJson && pkgJson?.version ? pkgJson.version : "-1"}`)
);

app.use(cacheConfigSetter(BASE_PATH.length));
app.basePath(BASE_PATH).route("/hianime", hianimeRouter);
app
  .basePath(BASE_PATH)
  .get("/anicrush", (c) => c.text("Anicrush could be implemented in future."));

app.notFound(notFoundHandler);
app.onError(errorHandler);

try {
  serve({
    port: Number(PORT),
    fetch: app.fetch,
  });
  console.info(`Aniwatch API running on port ${PORT}`);
} catch (err) {
  console.error("Failed to start server:", err);
}

if (ISNT_PERSONAL_DEPLOYMENT) {
  const interval = 9 * 60 * 1000; // 9 minutes
  setInterval(() => {
    console.log("aniwatch-api HEALTH_CHECK at", new Date().toISOString());
    https.get(`https://${ANIWATCH_API_HOSTNAME}/health`).on("error", (err) => {
      console.error(err.message);
    });
  }, interval);
}

export default app;
