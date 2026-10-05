/* E2E — the virtual pianist plays a full song lesson through the REAL mic
 * pipeline (ACF2+ + onset detection + echo suppression) into the grader.
 * `mic.spec.js` covers the mechanics; this file sweeps ALL content.
 */
const { test, expect } = require("@playwright/test");
const { startPage, armVirtualMic, enableMic, progress, awaitFinish, data } = require("./helpers");
const D = data();
const PLAYABLE = D.units.filter(u => u.type === "song");       // keyfind/trainer get their own spec
const SONG_IDS = new Set(PLAYABLE.map(u => u.song));
const ALL_SONGS = D.songs.filter(s => SONG_IDS.has(s.id) || !s.exercise);

test.describe("full-content sweep via microphone", () => {
  test.describe.configure({ mode: "serial" });

  test("sanity: mic pipeline detects a single note", async ({ page, context }) => {
    await startPage({ page, context });
    // one C4 held
    await armVirtualMic(page, [{ midi: 60, beats: 2 }], 90);
    const detected = await page.evaluate(async () => {
      const notes = [];
      await window.Mic.start(m => { if (notes.length < 3) notes.push(m); });
      await new Promise(r => setTimeout(r, 2500));
      window.Mic.stop();
      return notes;
    });
    expect(detected.length, "mic should fire at least one note").toBeGreaterThanOrEqual(1);
    expect(detected[0], "should detect C4=60, got " + detected).toBe(60);
  });

  test("song lesson graded via mic: Hot Cross Buns (step)", async ({ page, context }) => {
    await startPage({ page, context });
    const song = D.songs.find(s => s.id === "hot-cross-buns");
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto("/");
    await armVirtualMic(page, song.steps, song.tempo);
    await page.locator("nav button[data-view=songs]").click();
    await page.locator(".card", { hasText: "Hot Cross Buns" }).locator("button[data-mode=step]").click();
    await enableMic(page);
    await page.locator("#l-start").click();
    const res = await awaitFinish(page, 180_000);
    expect(res.stars).toBeGreaterThanOrEqual(2);
    expect(res.verdict).toContain("passed");
  });

  for (const song of ALL_SONGS) {
    const tag = song.exercise ? "exercise" : "song";
    const chordSong = song.steps.some(st => !st.rest && Array.isArray(st.midi));
    test(`${tag}: ${song.title} (mic, step)`, async ({ page, context }, testInfo) => {
      testInfo.setTimeout(150_000);
      await startPage({ page, context });
      await page.evaluate(() => { localStorage.clear(); });
      // jump straight into the song lesson (step mode) without course gating
      await page.goto("/");
      await armVirtualMic(page, song.steps, song.tempo);
      await page.locator("nav button[data-view=songs]").click();
      const card = page.locator(".card", { hasText: song.title }).first();
      await card.scrollIntoViewIfNeeded();
      await card.locator("button[data-mode=step]").click();
      await page.locator("#l-start").click();  // start first, then play
      if (chordSong) {
        // mic is monophonic — chord songs grade by tapping the on-screen keys
        await expect(page.locator("#l-mic")).toBeDisabled();
        for (const step of song.steps.filter(s => !s.rest)) {
          const midis = Array.isArray(step.midi) ? step.midi : [step.midi];
          // sequential clicks (concurrent clicks race in Playwright); the
          // remaining-set grader advances when the last member lands
          for (const m of midis) {
            await page.locator(`.wk[data-midi="${m}"], .bk[data-midi="${m}"]`).first().click();
          }
          await page.waitForTimeout(150);
        }
      } else {
        await enableMic(page);
      }
      const res = await awaitFinish(page, 140_000);
      // the virtual pianist plays perfectly on time in step mode (timing-free)
      expect(res.stars, `${song.id}: ${res.stat}`).toBeGreaterThanOrEqual(3);
    });
  }

  test("course units u1–u5 playable via mic (keyfind + trainer drills)", async ({ page, context }, testInfo) => {
    testInfo.setTimeout(180_000);
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    for (const unitId of ["u1","u2","u3","u4","u5"]) {
      const u = D.units.find(x => x.id === unitId);
      const pool = u.notes || u.fixedNotes;
      await page.goto("/");
      await page.locator("nav button[data-view=course]").click();
      await page.locator("#course-list .card", { hasText: u.title }).first().click();
      // arm a long random sequence from the unit's pool; step mode ignores
      // non-matching notes, so a superset sequence drives the drill to completion
      const wav = await page.evaluate(({ pool, goal }) => {
        const steps = [];
        for (let i = 0; i < goal * 4; i++) {
          steps.push({ midi: pool[Math.floor(Math.random() * pool.length)], beats: 1 });
        }
        const ab = window.renderWav(steps, 88);
        let binary = "";
        const bytes = new Uint8Array(ab);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      }, { pool, goal: u.goal || 6 });
      await page.evaluate((b64) => {
        const bin = atob(b64);
        const ab = new ArrayBuffer(bin.length);
        const u8 = new Uint8Array(ab);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        window.__virtualMicWav = ab;
        window.__virtualMicDefer = false;
        window.__virtualMicLoop = true;
      }, wav);
      await enableMic(page);
      await page.locator("#l-start").click();
      const res = await awaitFinish(page, 120_000);
      expect(res.stars, `${unitId}: ${res.stat}`).toBeGreaterThanOrEqual(2);
    }
  });

  test("all course units are wired (data integrity via UI)", async ({ page, context }) => {
    await startPage({ page, context });
    await page.evaluate(() => { localStorage.clear(); });
    await page.locator("nav button[data-view=course]").click();
    const cards = page.locator("#course-list .card");
    await expect(cards).toHaveCount(D.units.length);
    // every unit card shows a title
    const titles = await cards.locator("h3").allTextContents();
    expect(titles.filter(t => t.includes("🔒")).length, "fresh state locks all but the first").toBe(D.units.length - 1);
    // first unit unlocked & clickable
    await cards.first().click();
    await expect(page.locator("#lane")).toBeVisible();
  });
});
