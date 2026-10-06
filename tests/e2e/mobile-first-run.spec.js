/* Mobile first-run: reproduce "doesn't work on my phone" — iPhone viewport,
 * onboarding, open first lesson, try to play. */
const { test, expect } = require("@playwright/test");
const { startPage } = require("./helpers");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true }); // iPhone 14

test("mobile: first lesson is usable", async ({ page, context }) => {
  page.on("pageerror", e => console.log("PAGEEXC:", e.message));
  await startPage({ page, context });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto("/");
  await page.locator("#ob-skip").click();
  await page.locator("nav button[data-view=course]").click();
  await page.locator(".cmap-node:not(.locked)").first().click();
  // lane must fit and be tappable
  const lane = page.locator("#lane");
  await expect(lane).toBeVisible();
  const box = await lane.boundingBox();
  console.log("lane box:", JSON.stringify(box));
  expect(box.width).toBeLessThan(420);
  await page.locator("#l-start").click();
  // tap the highlighted key (C4)
  const hl = page.locator(".wk.hl, .bk.hl").first();
  await expect(hl).toBeVisible({ timeout: 5000 });
  const hlBox = await hl.boundingBox();
  console.log("highlighted key box:", JSON.stringify(hlBox));
  expect(hlBox.width).toBeGreaterThan(25); // tappable width
  await hl.tap();
  // progress advanced?
  await page.waitForTimeout(600);
  const st = await page.locator("#l-status").textContent();
  console.log("status after tap:", st);
  expect(st).toMatch(/1 \/ \d+/);
  // tap remaining notes: D, E, C, D, C... expect progress to keep moving
  for (let i = 0; i < 16; i++) {
    const cur = page.locator(".wk.hl, .bk.hl").first();
    if (!(await cur.isVisible().catch(() => false))) break;
    await cur.tap();
    await page.waitForTimeout(120);
  }
  const st2 = await page.locator("#l-status").textContent();
  console.log("status after taps:", st2);
});
