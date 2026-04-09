// @ts-check
import "dotenv/config";
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import proxy from "express-http-proxy";

import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { removeBackground, generateStudioBackground } from "./ai-handler.js";

console.log("DEBUG: SHOPIFY_API_KEY:", process.env.SHOPIFY_API_KEY ? "Loaded" : "MISSING");
console.log(`DEBUG: PORTS -> BACKEND: ${process.env.PORT}, FRONTEND: ${process.env.FRONTEND_PORT}`);
console.log(`DEBUG: HOST: ${process.env.HOST}`);
console.log(`DEBUG: NODE_ENV: ${process.env.NODE_ENV}`);

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);
const STATIC_PATH = process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Increase JSON body limit for large product photos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Trace requests with timing and clearer logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[RESPONSE] ${req.method} ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`);
  });
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  res.removeHeader("X-Frame-Options");
  next();
});

// Authentication and Webhooks (MUST be before any catch-all)
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

app.use("/api/*", shopify.validateAuthenticatedSession());

// API Routes
app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({ session: res.locals.shopify.session });
  const countData = await client.request(`query shopifyProductCount { productsCount { count } }`);
  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/ai/remove-bg", async (req, res) => {
  try {
    const { image } = req.body;
    const result = await removeBackground(image);
    res.status(200).send({ result });
  } catch (error) {
    console.error("AI Error (remove-bg):", error);
    res.status(500).send({ 
      error: error instanceof Error ? error.message : "Unknown error during background removal",
      details: error
    });
  }
});

app.post("/api/ai/generate-studio", async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image || !prompt) {
      return res.status(400).send({ error: "Missing image or prompt" });
    }
    const result = await generateStudioBackground(image, prompt);
    res.status(200).send({ result });
  } catch (error) {
    console.error("AI Error (generate-studio):", error);
    res.status(500).send({ 
      error: error instanceof Error ? error.message : "Unknown error during studio generation",
      details: error
    });
  }
});

// DEVELOPMENT PROXY - Move this UP so assets are intercepted before they hit the HTML handler
if (process.env.NODE_ENV !== "production") {
  app.use("/", (req, res, next) => {
    const url = req.originalUrl.split('?')[0];
    // If it's the root or doesn't have an extension, it's likely a page request -> skip to HTML handler
    if (url === "/" || !url.includes(".")) {
      return next();
    }
    // Otherwise, it's an asset (js, css, hmr) -> proxy it to Vite
    const frontendPort = process.env.FRONTEND_PORT || "5173";
    console.log(`[PROXY] Forwarding ${url} to 127.0.0.1:${frontendPort}`);
    return proxy(`127.0.0.1:${frontendPort}`, {
      proxyReqPathResolver: (req) => req.originalUrl,
      proxyErrorHandler: (err, res, next) => {
        console.error(`[PROXY ERROR] Failed to connect to Vite on port ${frontendPort}:`, err.message);
        res.status(502).send(`Front-end dev server (Vite) unreachable on port ${frontendPort}. Check your terminal for Vite errors.`);
      }
    })(req, res, next);
  });
}

// HTML Handler
app.get("/*", shopify.ensureInstalledOnShop(), shopify.cspHeaders(), async (req, res) => {
  const shop = req.query.shop;
  console.log(`[HTML] Serving index.html for shop: ${shop}`);
  
  const htmlPath = join(STATIC_PATH, "index.html");
  try {
    let html = readFileSync(htmlPath).toString();
    html = html.replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "");
    res.status(200).set("Content-Type", "text/html").send(html);
  } catch (e) {
    console.error("Failed to read index.html", e);
    res.status(500).send("Internal Server Error: Missing index.html");
  }
});

// Fallback to static files
app.use(serveStatic(STATIC_PATH, { index: false }));

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
