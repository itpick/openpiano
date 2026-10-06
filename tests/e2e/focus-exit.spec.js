/* Focus mode exit via the floating 🎹 Menu button */
const { test, expect } = require("@playwright/test");
const { startPage } = require("./helpers");
test.use({ viewport: { width: 844, height: 390 } });

test("focus mode: 🎹 Menu button exits to the menu", async ({ page, context }) => {
  await startPage({ page, context });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto("/");
  await page.locator("#ob-skip").click();
  await page.locator("nav button[data-view=course]").click();
  await page.locator(".cmap-node:not(.locked)").first().click();
  await page.locator("#fs-btn").click();
  await expect(page.locator("header.app")).toBeHidden();
  // floating menu button visible in focus mode
  await expect(page.locator("#focus-exit")).toBeVisible();
  // tap it → back to normal chrome
  await page.locator("#focus-exit").click();
  await expect(page.locator("header.app")).toBeVisible();
  // and we're still in the lesson
  await expect(page.locator("#lane")).toBeVisible();
});
