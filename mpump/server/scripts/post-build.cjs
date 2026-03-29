#!/usr/bin/env node
/**
 * Post-build script: landing page setup + service worker version bump.
 * Run after vite build.
 */
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

// 1. Keep app at app.html, redirect index.html → app.html
fs.renameSync(path.join(dist, "index.html"), path.join(dist, "app.html"));
fs.writeFileSync(path.join(dist, "index.html"), `<!DOCTYPE html><html><head><title>mpump</title><link rel="canonical" href="https://mpump.live/landing.html"><script>location.replace("landing.html")</script></head><body><noscript><a href="landing.html">mpump — Instant Browser Groovebox</a></noscript></body></html>`);
console.log("Landing page: redirect index.html → landing.html");

// 2. Service worker: inject version from package.json
const swPath = path.join(dist, "sw.js");
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, "utf8");
  sw = sw.replace(
    /const CACHE_VERSION = "[^"]*"/,
    `const CACHE_VERSION = "${pkg.version}"`
  );
  fs.writeFileSync(swPath, sw);
  console.log("SW cache version:", pkg.version);
}
