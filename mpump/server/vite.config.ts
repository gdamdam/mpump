import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// Auto-update version.json and sw.js cache version on build
writeFileSync("./public/version.json", JSON.stringify({ v: pkg.version }) + "\n");
const swPath = "./public/sw.js";
const sw = readFileSync(swPath, "utf-8");
writeFileSync(swPath, sw.replace(/const CACHE_VERSION = "[^"]+";/, `const CACHE_VERSION = "${pkg.version}";`));

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-dom/client"],
          qrcode: ["qrcode"],
          pako: ["pako"],
        },
      },
    },
  },
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
