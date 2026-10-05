const { test, expect } = require("@playwright/test");
const { startPage, armVirtualMic, data } = require("./helpers");
const D = data();
test("debug press counting", async ({ page, context }) => {
  page.on("pageerror", e => console.log("PAGEEXC:", e.message));
  await startPage({ page, context });
  await page.evaluate(() => { localStorage.clear(); });
  const song = D.songs.find(s => s.id === "country-roads");
  await page.goto("/");
  await armVirtualMic(page, song.steps, song.tempo);
  await page.locator("nav button[data-view=songs]").click();
  await page.locator(".card", { hasText: "Country Roads" }).first().locator("button[data-mode=step]").click();
  // instrument BEFORE start
  await page.evaluate(() => {
    window.__presses=[];
    const kb=document.querySelector(".kb");
    ["pointerdown"].forEach(t=>kb.addEventListener(t,e=>{
      window.__presses.push({type:t, x:e.clientX, y:e.clientY});
    }, true));
  });
  await page.locator("#l-start").click();
  await page.locator(".wk[data-midi='60']").click();
  const st = await page.evaluate(()=>({
    presses: window.__presses,
    status: document.getElementById("l-status").textContent,
    running: !!document.querySelector("#l-restart:not(.hidden)")
  }));
  console.log(JSON.stringify(st));
});
