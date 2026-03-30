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
fs.writeFileSync(path.join(dist, "index.html"), `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>mpump — browser groovebox where grooves live in links</title><meta name="description" content="Make a groove. Send a link. Open, change, and resend. A browser instrument for shaping and sharing electronic music. No install. No account."><meta property="og:title" content="mpump — browser groovebox where grooves live in links"><meta property="og:description" content="Make a groove. Send a link. Open, change, and resend. A browser instrument for shaping and sharing electronic music. No install. No account."><meta property="og:url" content="https://mpump.live/"><meta property="og:type" content="website"><meta property="og:site_name" content="mpump"><meta property="og:image" content="https://mpump.live/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="mpump — browser groovebox where grooves live in links"><meta name="twitter:description" content="Make a groove. Send a link. Open, change, and resend. No install. No account."><meta name="twitter:image" content="https://mpump.live/og-image.png"><link rel="canonical" href="https://mpump.live/landing.html"><script>location.replace("landing.html")</script></head><body><noscript><a href="landing.html">mpump — browser groovebox where grooves live in links</a></noscript></body></html>`);
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
