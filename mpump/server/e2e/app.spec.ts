import { test, expect } from "@playwright/test";

test.describe("App loads", () => {
  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.locator(".midi-gate")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("landing page shows key elements", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".midi-gate-logo")).toBeVisible();
    await expect(page.locator(".midi-gate-subtitle")).toHaveText("Instant Browser Groovebox");
    await expect(page.locator(".midi-gate-btn-preview")).toBeVisible();
  });
});

test.describe("AudioContext on user interaction", () => {
  test("AudioContext initializes after clicking Play", async ({ page }) => {
    await page.goto("/");
    await page.click(".midi-gate-btn-preview");

    // Wait for the app to transition past the gate
    await expect(page.locator(".midi-gate")).not.toBeVisible({ timeout: 5000 });

    const hasAudioCtx = await page.evaluate(() => {
      return typeof AudioContext !== "undefined" || typeof (window as unknown as Record<string, unknown>).webkitAudioContext !== "undefined";
    });
    expect(hasAudioCtx).toBe(true);
  });
});
