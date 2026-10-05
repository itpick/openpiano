const { test, expect } = require("@playwright/test");
const { startPage, armVirtualMic, data } = require("./helpers");
const D = data();
test("debug full chord presses", async ({ page, context }) => {
  page.on("pageerror", e => console.log("PAGEEXC:", e.message));
  await startPage({ page, context });
  await page.evaluate(() => { localStorage.clear(); });
  const song = D.songs.find(s => s.id === "country-roads");
  await page.goto("/");
  await page.locator("nav button[data-view=songs]").click();
  await page.locator(".card", { hasText: "Country Roads" }).first().locator("button[data-mode=step]").click();
  await page.locator("#l-start").click();
  // chord 1: [60,64,67]
  await page.locator(".wk[data-midi='60']").click();
  const s1 = await page.locator("#l-status").textContent();
  await page.locator(".wk[data-midi='64']").click();
  const s2 = await page.locator("#l-status").textContent();
  await page.locator(".wk[data-midi='67']").click();
  const s3 = await page.locator("#l-status").textContent();
  console.log("after 60:", s1, "| after 64:", s2, "| after 67:", s3);
});
