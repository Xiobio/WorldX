#!/usr/bin/env node
/**
 * Tiny static file server for the zone viewer.
 *
 * Serves:
 *   /viewer/*       → viewer/ directory
 *   /zones/<id>/*   → output/zones/<id>/*
 *   /chars/*        → library/worlds/world_2026-04-19T17-12-41/characters/* (sprite source)
 *
 * Usage: node scripts/serve-zone-viewer.mjs [port]
 *        Default port: 8765
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".tmj": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const PORT = parseInt(process.argv[2] || "8765", 10);

const ROUTES = [
  { prefix: "/viewer/", dir: join(ROOT, "viewer") },
  { prefix: "/zones/", dir: join(ROOT, "output/zones") },
  { prefix: "/worlds/", dir: join(ROOT, "output/worlds") },
  { prefix: "/library-worlds/", dir: join(ROOT, "library/worlds") },
];

function resolvePath(urlPath) {
  // Strip query string
  const path = urlPath.split("?")[0];
  if (path === "/" || path === "/index.html") {
    return join(ROOT, "viewer/zone-walker.html");
  }
  for (const route of ROUTES) {
    if (path.startsWith(route.prefix)) {
      const rel = path.slice(route.prefix.length);
      const full = join(route.dir, rel);
      // Block traversal
      if (!full.startsWith(route.dir)) return null;
      return full;
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const filePath = resolvePath(req.url);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
    return;
  }
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      res.writeHead(403);
      res.end("403 Forbidden");
      return;
    }
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`404: ${e.code || e.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  ╭───────────────────────────────────────╮`);
  console.log(`  │  Zone Viewer running                  │`);
  console.log(`  │  http://localhost:${PORT}                │`);
  console.log(`  ╰───────────────────────────────────────╯\n`);
  console.log(`  Try: http://localhost:${PORT}/?zone=ionia-full_2026-05-06T07-02-24\n`);
});
