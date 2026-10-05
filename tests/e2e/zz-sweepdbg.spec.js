const { test, expect } = require("@playwright/test");
const { startPage, armVirtualMic, data } = require("./helpers");
const D = data();
test("debug sweep country", async ({ page, context }) => {
  page.on("pageerror", e => console.log("PAGEEXC:", e.message));
  await startPage({ page, context });
  await page.evaluate(() => { localStorage.clear(); });
  const song = D.songs.find(s => s.id === "country-roads");
  await page.goto("/");
  await armVirtualMic(page, song.steps, song.tempo);
  await page.locator("nav button[data-view=songs]").click();
  const card = page.locator(".card", { hasText: "Country Roads" }).first();
  await card.scrollIntoViewIfNeeded();
  await card.locator("button[data-mode=step]").click();
  await page.locator("#l-start").click();
  for (const step of song.steps) {
    const midis = Array.isArray(step.midi) ? step.midi : [step.midi];
    await Promise.all(midis.map(m =>
      page.locator(`.wk[data-midi="${m}"], .bk[data-midi="${m}"]`).first().click()
    ));
    await page.waitForTimeout(150);
    console.log("status:", await page.locator("#l-status").textContent());
  }
});
