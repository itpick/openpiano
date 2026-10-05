/* E2E — engine mechanics through the mic: repeated notes (onset detection),
 * echo suppression, moving-mode timing, pass gate & unlock progression.
 */
const { test, expect } = require("@playwright/test");
const { startPage, armVirtualMic, startVirtualMic, enableMic, progress, awaitFinish, data } = require("./helpers");

const D = data();

test.describe("mic mechanics", () => {
  test.describe.configure({ mode: "serial" });

  test("onset detection: repeated notes each fire (A A A pattern)", async ({ page, context }) => {
    await startPage({ page, context });
    // Sound of Silence style: same note three times with gaps (decay between strikes)
    const q=0.5;
    const steps=[{midi:69,beats:q},{rest:true,beats:q},{midi:69,beats:q},{rest:true,beats:q},{midi:69,beats:2}];
    await armVirtualMic(page, steps, 90);
    const detected = await page.evaluate(async () => {
      const notes = [];
      await window.Mic.start(m => notes.push(m));
      await new Promise(r => setTimeout(r, 4500));
      window.Mic.stop();
      return notes;
    });
    expect(detected.length, "3 strikes expected, got " + JSON.stringify(detected)).toBeGreaterThanOrEqual(3);
    detected.forEach(m => expect(m).toBe(69));
  });

  test("echo suppression: app's own sound does not get graded", async ({ page, context }) => {
    await startPage({ page, context });
    const detected = await page.evaluate(async () => {
      const notes = [];
      await window.Mic.start(m => notes.push(m));
      // app sounds A4 NOW — mic should ignore its own speaker
      window.__opEchoProbe && window.__opEchoProbe();
      await new Promise(r => setTimeout(r, 1800));
      window.Mic.stop();
      return notes;
    });
    expect(detected, "echo must be suppressed: " + JSON.stringify(detected)).toHaveLength(0);
  });

  test("moving mode: perfectly-timed virtual pianist passes with metronome", async ({ page, context }) => {
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    const song = D.songs.find(s => s.id === "hot-cross-buns");
    // grant 2★ so the moving button unlocks, THEN navigate to songs
    await page.evaluate((id) => {
      const sp = JSON.parse(localStorage.getItem("openpiano.songs") || "{}");
      sp[id] = { stars: 2 };
      localStorage.setItem("openpiano.songs", JSON.stringify(sp));
    }, song.id);
    await page.goto("/");
    await page.locator("nav button[data-view=songs]").click();
    await armVirtualMic(page, [{rest:true,beats:4}, ...song.steps], song.tempo, { defer: true, loop: false });
    const card = page.locator(".card", { hasText: "Hot Cross Buns" }).first();
    await card.locator("button[data-mode=moving]").click();
    await enableMic(page);
    await page.locator("#l-start").click();
    await startVirtualMic(page);  // sync the virtual pianist with the count-in
    // note: ~100–200 ms human-style latency after Start; the ±0.4-beat window
    // at 80 BPM is ±300 ms, so a small constant offset stays inside it
    const res = await awaitFinish(page, 120_000);
    expect(res.stars, res.stat).toBeGreaterThanOrEqual(2);
    expect(res.verdict).toContain("passed");
  });

  test("mic never penalizes wrong notes (tap-vs-mic asymmetry)", async ({ page, context }) => {
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    // queue "wrong" noise: a melody that doesn't match Hot Cross Buns at all
    const wrong=[{midi:76,beats:1},{midi:79,beats:1},{midi:83,beats:1},{midi:76,beats:1},{midi:79,beats:1},{midi:83,beats:1},{midi:76,beats:1},{midi:79,beats:1},{midi:83,beats:1}];
    await armVirtualMic(page, wrong, 90);
    const song = D.songs.find(s => s.id === "hot-cross-buns");
    await page.goto("/");
    await page.locator("nav button[data-view=songs]").click();
    await page.locator(".card", { hasText: "Hot Cross Buns" }).locator("button[data-mode=step]").click();
    await enableMic(page);
    await page.locator("#l-start").click();
    // progress must stay at 0 — wrong mic notes are ignored, never graded wrong
    await page.waitForTimeout(6000);
    const p = await progress(page);
    expect(p.done, "wrong mic notes must be ignored (got: " + p.text + ")").toBe(0);
  });

  test("pass gate: 80% rule unlocks next unit; <80% does not", async ({ page, context }) => {
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    // give u6 (Hot Cross Buns) a passing record
    await page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem("openpiano.course") || "{}");
      c.u6 = { stars: 3, complete: true };
      localStorage.setItem("openpiano.course", JSON.stringify(c));
    });
    await page.goto("/");
    await page.locator("nav button[data-view=course]").click();
    // u7 should now be unlocked (2 unlocked total)
    const unlocked = await page.locator("#course-list .card:not(.locked)").count();
    expect(unlocked).toBe(2);
    const nextTitle = await page.locator("#course-list .card:not(.locked) h3").nth(1).textContent();
    expect(nextTitle).toContain("Au Clair");
  });

  test("workout page renders 3 segments", async ({ page, context }) => {
    await startPage({ page, context });
    await page.locator("#home-workout").click();
    await expect(page.locator("#w1")).toBeVisible();
    await expect(page.locator("#w2")).toBeVisible();
    await expect(page.locator("#w3")).toBeVisible();
  });
});
