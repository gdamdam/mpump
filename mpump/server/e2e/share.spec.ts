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

test.describe("Share modal", () => {
  test("share button opens modal with a link", async ({ page }) => {
    await startApp(page);

    await page.click("[aria-label='Share setup']");
    await expect(page.locator(".share-modal")).toBeVisible({ timeout: 3000 });

    const urlInput = page.locator(".share-url-input");
    await expect(urlInput).toBeVisible();
    const url = await urlInput.inputValue();
    expect(url).toContain("s.mpump.live/?b=");
  });
});

test.describe("Share link works for receiver", () => {
  test("receiver can open a share link and play", async ({ browser }) => {
    // --- Sender: generate a share link ---
    const senderCtx = await browser.newContext();
    const sender = await senderCtx.newPage();
    await sender.addInitScript(() => {
      localStorage.setItem("mpump-tutorial-done", "1");
    });
    await sender.goto("/");
    await sender.click(".midi-gate-btn-preview");
    await expect(sender.locator(".kaos-selector").first()).toBeVisible({ timeout: 10000 });

    await sender.click("[aria-label='Share setup']");
    await expect(sender.locator(".share-url-input")).toBeVisible({ timeout: 3000 });
    const shareUrl = await sender.locator(".share-url-input").inputValue();
    expect(shareUrl).toContain("?b=");

    // Extract the payload
    const payload = new URL(shareUrl).searchParams.get("b");
    expect(payload).toBeTruthy();

    // --- Receiver: open with ?b= param ---
    const receiverCtx = await browser.newContext();
    const receiver = await receiverCtx.newPage();
    await receiver.addInitScript(() => {
      localStorage.setItem("mpump-tutorial-done", "1");
    });

    const errors: string[] = [];
    receiver.on("pageerror", (e) => errors.push(e.message));

    await receiver.goto(`/?b=${payload}`);

    // Receiver sees the share gate with play button
    await expect(receiver.locator(".midi-gate-btn-preview")).toBeVisible({ timeout: 5000 });
    await receiver.click(".midi-gate-btn-preview");

    // App should start — kaos panels appear
    await expect(receiver.locator(".kaos-selector").first()).toBeVisible({ timeout: 10000 });

    expect(errors).toEqual([]);

    await sender.close();
    await receiver.close();
    await senderCtx.close();
    await receiverCtx.close();
  });
});
