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

/** Get the first genre row's Next button and current genre text. */
function drumsGenreRow(page: import("@playwright/test").Page) {
  // The first .kaos-selector is DRUMS; within it, the GENRE row has nav buttons
  const selector = page.locator(".kaos-selector").first();
  const genreRow = selector.locator(".kaos-sel-row", { hasText: "GENRE" });
  return {
    next: genreRow.locator(".kaos-sel-btn[title='Next']"),
    prev: genreRow.locator(".kaos-sel-btn[title='Previous']"),
    value: genreRow.locator(".kaos-dropdown-trigger"),
  };
}

function drumsPatternRow(page: import("@playwright/test").Page) {
  const selector = page.locator(".kaos-selector").first();
  const patRow = selector.locator(".kaos-sel-row", { hasText: "PATTERN" });
  return {
    next: patRow.locator(".kaos-sel-btn[title='Next']"),
    value: patRow.locator(".kaos-dropdown-trigger"),
  };
}

test.describe("Genre and pattern selection", () => {
  test("genre navigation changes the displayed genre", async ({ page }) => {
    await startApp(page);
    const { next, value } = drumsGenreRow(page);
    const initial = await value.textContent();

    await next.click();
    await expect(value).not.toHaveText(initial!);
  });

  test("pattern navigation changes the displayed pattern", async ({ page }) => {
    await startApp(page);
    const { next, value } = drumsPatternRow(page);
    const initial = await value.textContent();

    await next.click();
    await expect(value).not.toHaveText(initial!);
  });

  test("previous genre wraps or changes", async ({ page }) => {
    await startApp(page);
    const { prev, value } = drumsGenreRow(page);
    const initial = await value.textContent();

    await prev.click();
    await expect(value).not.toHaveText(initial!);
  });
});
