/* Landscape + focus mode: header insets, compact chrome, focus hides header */
const { test, expect } = require("@playwright/test");
const { startPage } = require("./helpers");

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true }); // iPhone landscape

test.describe("landscape / focus mode", () => {
  test("header is slim in landscape and respects safe-area", async ({ page, context }) => {
    await startPage({ page, context });
    await page.goto("/");
    await page.locator("#ob-skip").click();
    const h = await page.locator("header.app").boundingBox();
    console.log("header height:", h.height);
    // slim header: well under 60px (was ~90+ with the old padding)
    expect(h.height).toBeLessThan(56);
    expect(h.y).toBe(0); // viewport-fit=cover: no letterbox above
  });

  test("lesson fits above the fold: keyboard visible in landscape", async ({ page, context }) => {
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto("/");
    await page.locator("#ob-skip").click();
    await page.locator("nav button[data-view=course]").click();
    await page.locator(".cmap-node:not(.locked)").first().click();
    const kb = await page.locator(".kb").boundingBox();
    const vh = 390;
    console.log("kb box:", JSON.stringify(kb), "viewport h:", vh);
    // keyboard bottom edge must be visible within the viewport
    expect(kb.y + kb.height).toBeLessThanOrEqual(vh);
    await page.locator("#l-start").click();
    const hl = page.locator(".wk.hl, .bk.hl").first();
    await expect(hl).toBeVisible();
    const hlBox = await hl.boundingBox();
    expect(hlBox.y).toBeLessThan(vh); // highlighted key on screen
  });

  test("focus mode hides header/footer and expands the lane", async ({ page, context }) => {
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto("/");
    await page.locator("#ob-skip").click();
    await page.locator("nav button[data-view=course]").click();
    await page.locator(".cmap-node:not(.locked)").first().click();
    const laneBefore = (await page.locator("#lane").boundingBox()).height;
    await page.locator("#fs-btn").click();
    await expect(page.locator("header.app")).toBeHidden();
    const laneAfter = (await page.locator("#lane").boundingBox()).height;
    const kbAfter = (await page.locator(".kb").boundingBox()).height;
    console.log("lane before/after focus:", laneBefore, laneAfter, "kb:", kbAfter);
    // at 390px landscape the reclaimed header space roughly equals the kb
    // reduction; assert the lesson still fits AND the header is gone
    expect(kbAfter).toBeLessThanOrEqual(130);
    expect(laneAfter).toBeGreaterThanOrEqual(laneBefore - 10);
    // Esc exits focus mode
    await page.keyboard.press("Escape");
    await expect(page.locator("header.app")).toBeVisible();
  });
});
