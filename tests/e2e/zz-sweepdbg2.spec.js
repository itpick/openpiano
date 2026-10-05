const { test, expect } = require("@playwright/test");
const { startPage, armVirtualMic, data } = require("./helpers");
const D = data();
test("debug minimal", async ({ page, context }) => {
  page.on("pageerror", e => console.log("PAGEEXC:", e.message));
  await startPage({ page, context });
  await page.evaluate(() => { localStorage.clear(); });
  const song = D.songs.find(s => s.id === "country-roads");
  await page.goto("/");
  await page.locator("nav button[data-view=songs]").click();
  await page.locator(".card", { hasText: "Country Roads" }).first().locator("button[data-mode=step]").click();
  await page.locator("#l-start").click();
  // tap chord 1 with logging
  const res = await page.evaluate(() => {
    const out={};
    const el = document.querySelector(".wk[data-midi='60']");
    out.found = !!el;
    // dispatch real pointer events manually
    ["pointerdown","pointerup"].forEach(type=>{
      el.dispatchEvent(new PointerEvent(type, {bubbles:true, pointerId:1, clientX: el.getBoundingClientRect().x+10, clientY: el.getBoundingClientRect().y+10}));
    });
    out.status = document.getElementById("l-status").textContent;
    out.running = !!(window.__opDebugLessonRunning);
    return out;
  });
  console.log(JSON.stringify(res));
});
