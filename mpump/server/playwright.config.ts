import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  use: {
    headless: true,
    baseURL: isCI ? "http://localhost:4173" : "http://localhost:5173",
  },
  webServer: {
    command: isCI ? "npm run build && npm run preview" : "npm run dev",
    port: isCI ? 4173 : 5173,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
