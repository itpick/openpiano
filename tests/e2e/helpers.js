/* OpenPiano e2e helpers — the "virtual pianist".
 *
 * A fake getUserMedia MediaStream whose audio is an AudioWorklet-free loop:
 * we render the expected melody to PCM (window.renderWav), then feed it into
 * an AnalyserNode exactly like a real mic would. mic.js reads that analyser's
 * time-domain data, so the ACF2+ pipeline + onset detection + echo suppression
 * all run for real against synthetic piano audio.
 */
const fs = require("fs");
const path = require("path");
const { expect } = require("@playwright/test");

const VIRTUAL_MIC_INIT = `
(() => {
  // ---- minimal WAV decode (16-bit PCM mono) ----
  function decodeWav(ab){
    const dv=new DataView(ab);
    const off=44, n=(ab.byteLength-44)/2, out=new Float32Array(n);
    for(let i=0;i<n;i++) out[i]=dv.getInt16(off+i*2,true)/32768;
    return {samples:out, sampleRate:dv.getUint32(24,true)};
  }

  // ---- the fake device ----
  let currentStream=null;
  function makeStreamFromWav(ab, loop=true){
    const {samples, sampleRate}=decodeWav(ab);
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==="suspended") ctx.resume();
    // buffer source + gain so we can re-trigger the attack per loop
    const dest=ctx.createMediaStreamDestination();
    let src=null, stop=false, started=false;
    function play(){
      if(stop) return;
      src=ctx.createBufferSource();
      const buf=ctx.createBuffer(1,samples.length,sampleRate);
      buf.copyToChannel(samples,0);
      src.buffer=buf;
      src.connect(dest);
      src.onended=()=>{ if((window.__virtualMicLoop!==false)&&!stop) play(); };
      src.start();
      started=true;
    }
    // deferred start: tests call window.__virtualMicStart() to sync with ▶ Start
    if(window.__virtualMicDefer){ window.__virtualMicStart=()=>{ if(!started&&!stop) play(); }; }
    else play();
    currentStream={ stream: dest.stream, stop(){ stop=true; try{src&&src.stop();}catch(e){} ctx.close(); }, _loopFn: null };
    // honor per-arm loop setting on rebuilt streams
    currentStream._loop = window.__virtualMicLoop !== false;
    // patch onended decision: loop only if enabled
    return dest.stream;
  }

  const realGUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;

  // Always return a (possibly silent) virtual stream. If the test queued a WAV,
  // rebuild the stream from it; otherwise a silent stream (true = no signal).
  navigator.mediaDevices.getUserMedia = async (constraints)=>{
    if(currentStream){ currentStream.stop(); currentStream=null; }
    const wav=window.__virtualMicWav; window.__virtualMicWav=null;
    const s=makeStreamFromWav(wav||SILENT_WAV, true);
    currentStream={ stream:s, stop(){} };
    return s;
  };

  // 0.5 s of digital silence at 44.1 kHz, 16-bit mono WAV
  const SILENT_WAV=(()=>{
    const sr=44100, n=sr/2, ab=new ArrayBuffer(44+n*2), dv=new DataView(ab);
    const w=(o,s)=>{ for(let i=0;i<s.length;i++) dv.setUint8(o+i,s.charCodeAt(i)); };
    w(0,"RIFF"); dv.setUint32(4,36+n*2,true); w(8,"WAVE");
    w(12,"fmt "); dv.setUint32(16,16,true); dv.setUint16(20,1,true);
    dv.setUint16(22,1,true); dv.setUint32(24,sr,true); dv.setUint32(28,sr*2,true);
    dv.setUint16(32,2,true); dv.setUint16(34,16,true);
    w(36,"data"); dv.setUint32(40,n*2,true);
    return ab.buffer || ab;
  })();
})();
`;

async function startPage({ page, context }) {
  await context.addInitScript(VIRTUAL_MIC_INIT);
  await page.goto("/");
  await expect(page.locator("header.app .logo")).toBeVisible();
}

/** Queue a melody (steps,bpm) into the virtual mic. opts.defer=true → playback
 *  waits for startVirtualMic() (sync with ▶ Start in moving mode). */
async function armVirtualMic(page, steps, bpm, opts={}) {
  const wavB64 = await page.evaluate(
    ({ steps, bpm }) => {
      const ab = window.renderWav(steps, bpm);
      let binary = "";
      const bytes = new Uint8Array(ab);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    },
    { steps, bpm }
  );
  await page.evaluate(({ b64, defer, loop }) => {
    const bin = atob(b64);
    const ab = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(ab);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    window.__virtualMicWav = ab;
    window.__virtualMicDefer = !!defer;
    window.__virtualMicLoop = loop !== false;
  }, { b64: wavB64, defer: !!opts.defer, loop: opts.loop !== false });
}

/** Start deferred virtual-mic playback (call right after ▶ Start). */
async function startVirtualMic(page) {
  await page.evaluate(() => {
    if (window.__virtualMicStart) window.__virtualMicStart();
  });
}

/** Click the in-lesson Mic button (starts getUserMedia → our virtual stream). */
async function enableMic(page) {
  await page.locator("#l-mic").click();
  await expect(page.locator("#l-mic")).toContainText("listening", { timeout: 20_000 });
}

/** Read lesson progress "n / total" from the status line. */
async function progress(page) {
  const txt = await page.locator("#l-status").textContent();
  const m = txt.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { done: +m[1], total: +m[2], text: txt.trim() } : { done: -1, total: -1, text: txt.trim() };
}

/** Wait until the lesson finishes (finishbox appears) and return its stats. */
async function awaitFinish(page, timeout = 120_000) {
  await page.waitForSelector(".finishbox", { timeout });
  const stars = await page.locator(".finishbox .bigstars").textContent();
  const stat = await page.locator(".finishbox .stat").first().textContent();
  const verdict = await page.locator(".finishbox .pass, .finishbox .fail").textContent();
  return { stars: (stars.match(/★/g) || []).length, stat: stat.trim(), verdict: verdict.trim() };
}

/** All song lesson units (the ones the engine can play). */
function playableUnits() {
  const D = require(path.join(__dirname, "../../app/data.js"));
}
function data() {
  const sandbox = { window: {} };
  new Function("window", require("fs").readFileSync(path.join(__dirname, "../../app/data.js"), "utf8"))(sandbox.window);
  return sandbox.window.OPENPIANO_DATA;
}

module.exports = { startPage, armVirtualMic, startVirtualMic, enableMic, progress, awaitFinish, data, VIRTUAL_MIC_INIT };
