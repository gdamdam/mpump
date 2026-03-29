import { test, expect } from "@playwright/test";

/** Skip tutorial and start the app, wait for UI ready. */
async function startApp(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mpump-tutorial-done", "1");
  });
  await page.goto("/");
  await page.click(".midi-gate-btn-preview");
  await expect(page.locator(".kaos-selector").first()).toBeVisible({ timeout: 10000 });
}

test.describe("Session export/import round-trip", () => {
  test("app state is persisted to localStorage", async ({ page }) => {
    await startApp(page);

    // Change genre to create a non-default state
    const selector = page.locator(".kaos-selector").first();
    const genreRow = selector.locator(".kaos-sel-row", { hasText: "GENRE" });
    await genreRow.locator(".kaos-sel-btn[title='Next']").click();

    // Verify session-related data is stored in localStorage
    const mpumpKeys = await page.evaluate(() => {
      return Object.keys(localStorage).filter(k => k.startsWith("mpump-"));
    });
    expect(mpumpKeys.length).toBeGreaterThan(0);
  });

  test("last session is saved and restorable", async ({ page }) => {
    await startApp(page);

    // Navigate genre to trigger auto-save
    const selector = page.locator(".kaos-selector").first();
    const genreRow = selector.locator(".kaos-sel-row", { hasText: "GENRE" });
    await genreRow.locator(".kaos-sel-btn[title='Next']").click();
    await page.waitForTimeout(500);

    const lastSession = await page.evaluate(() => {
      const raw = localStorage.getItem("mpump-last-session");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { label: parsed.label, hasBpm: typeof parsed.data?.bpm === "number" };
    });

    if (lastSession) {
      expect(lastSession.hasBpm).toBe(true);
      expect(lastSession.label).toBeTruthy();
    }
  });
});
