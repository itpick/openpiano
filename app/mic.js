/* OpenPiano — microphone input (monophonic).
 *
 * Faithful port of simpli-piano's mic pipeline (research/simpli-piano-coniker/ARCHITECTURE.md):
 *   - ACF2+ autocorrelation pitch detection
 *   - rising-edge onset detection so repeated notes register
 *   - adaptive noise gate + absolute floor
 *   - STABLE_FRAMES of pitch agreement before a note fires
 *   - echo suppression: drop notes the app itself recently sounded
 * Monophonic by design — chord steps are tap-only (mic toggle hidden).
 *
 * Exposed as window.Mic: { start(onNote), stop(), info() }.
 */
(() => {
  "use strict";

  const QUIET_RMS = 0.0012;   // absolute floor (deliberately low: quiet pianos register)
  const ONSET_FLOOR = 0.004;  // ignore rises in near-silence (room noise)
  const NOISE_MULT = 2.2;     // signal must beat measured room noise by this
  const ONSET_RATIO = 1.12;   // rise above recent minimum that counts as re-strike
  const ONSET_MIN_MS = 100;   // debounce: no two onsets closer than this
  const STABLE_FRAMES = 3;    // frames that must agree before a note fires (~50 ms)
  const FREQ_LO = 55, FREQ_HI = 2100;
  const ECHO_WINDOW_MS = 1200;

  const freqToMidi = (f) => Math.round(69 + 12 * Math.log2(f / 440));

  let stream = null, analyser = null, buf = null, loopTimer = null;
  let onNoteCb = null;
  let noiseFloor = QUIET_RMS * NOISE_MULT;
  let quietestSinceOnset = Infinity;
  let lastOnsetT = 0;
  let stableMidi = null, stableCount = 0;
  let noteCount = 0, lastNote = null, running = false;
  let riseRatio = 1; // how sharply the current onset rose above the recent floor
  const recentPC = new Map(); // pitch class -> last performance.now() (echo suppression)

  const pc = (m) => ((m % 12) + 12) % 12;
  function isEcho(midi) {
    const t = recentPC.get(pc(midi));
    return t !== undefined && performance.now() - t < ECHO_WINDOW_MS;
  }
  function stampEcho(midi) { recentPC.set(pc(midi), performance.now()); }

  /* ACF2+ autocorrelation (the well-known approach from simpli-piano's mic.js) */
  function detectPitch(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < QUIET_RMS) return { freq: -1, rms };

    // normalized autocorrelation via ACF2+
    const c = new Float32Array(SIZE).fill(0);
    for (let lag = 0; lag < SIZE; lag++)
      for (let i = 0; i < SIZE - lag; i++)
        c[lag] += buf[i] * buf[i + lag];
    let d = 0; while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    if (maxpos <= 0) return { freq: -1, rms };
    let T0 = maxpos;
    // octave-error correction: prefer the lowest subharmonic whose correlation
    // is still strong (≥0.85 of the peak). Bright high notes with strong
    // harmonics otherwise detect an octave (or two) too high.
    for (const div of [3, 2]) {
      const cand = Math.round(maxpos / div);
      if (cand > d && c[cand] >= maxval * 0.85) { T0 = cand; break; }
    }
    // parabolic interpolation
    const x1 = c[T0 - 1] ?? 0, x2 = c[T0], x3 = c[T0 + 1] ?? 0;
    const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    const freq = sampleRate / T0;
    if (freq < FREQ_LO || freq > FREQ_HI) return { freq: -1, rms };
    return { freq, rms };
  }

  function loop() {
    if (!running) return;
    analyser.getFloatTimeDomainData(buf);
    const { freq, rms } = detectPitch(buf, analyser.context.sampleRate);

    // adaptive noise floor decays toward the absolute floor when quiet
    if (rms < noiseFloor) noiseFloor = Math.max(QUIET_RMS * NOISE_MULT, noiseFloor * 0.999);
    else noiseFloor = Math.min(noiseFloor * 1.001 + rms * 0.001, rms * 2);

    const now = performance.now();
    const signal = rms > Math.max(ONSET_FLOOR, noiseFloor);

    if (!signal) {
      quietestSinceOnset = Math.min(quietestSinceOnset, rms);
      stableMidi = null; stableCount = 0;
    } else {
      // track pitch FIRST — stability accumulates on every signal frame;
      // the onset gate only decides when a stable pitch FIRES as a note
      if (freq > 0) {
        const midi = freqToMidi(freq);
        if (midi === stableMidi) stableCount++; else { stableMidi = midi; stableCount = 1; }
      }
      // rising-edge onset: level climbed back above the quietest point since last onset
      const reStrike = rms > quietestSinceOnset * ONSET_RATIO && (now - lastOnsetT) > ONSET_MIN_MS;
      if (reStrike) {
        riseRatio = rms / Math.max(quietestSinceOnset, 1e-6);
        if (freq > 0 && stableCount >= STABLE_FRAMES) {
          const midi = freqToMidi(freq);
          lastOnsetT = now;
          quietestSinceOnset = Infinity;
          // Echo gate AFTER onset confirmation: a speaker tail never RISES
          // sharply, so only treat a same-pitch hit as echo when the rise was
          // gentle (<1.5x). A real re-strike rises hard (≥2x) and must grade.
          // Note: mic's own detections never stamp the echo map — only the
          // app's synth does (speaker output), so real playing (including
          // octave jumps like G3→G5, same pitch class) is never self-suppressed.
          if (!isEcho(midi) || riseRatio >= 1.5) {
            noteCount++; lastNote = midi;
            if (onNoteCb) onNoteCb(midi);
          }
        } else {
          // gate the rise but let stability keep accumulating
          quietestSinceOnset = Math.min(quietestSinceOnset, rms);
        }
      }
      if (rms < quietestSinceOnset) quietestSinceOnset = rms;
    }
  }

  async function start(cb) {
    if (running) return true;
    onNoteCb = cb;
    const media = navigator.mediaDevices || (navigator.webkitMediaDevices || null);
    if (!media || !media.getUserMedia) throw new Error("getUserMedia unavailable (needs HTTPS or localhost)");
    stream = await media.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    ensureCtx();    const src = actx.createMediaStreamSource(stream);
    analyser = actx.createAnalyser();
    analyser.fftSize = 2048;
    buf = new Float32Array(analyser.fftSize);
    src.connect(analyser); // analyser only — never to destination (no feedback)
    running = true;
    noiseFloor = QUIET_RMS * NOISE_MULT;
    quietestSinceOnset = Infinity;
    noteCount = 0; lastNote = null;
    // setInterval instead of rAF: headless/background tabs throttle rAF to ~1fps
    loopTimer = setInterval(loop, 30);
    return true;
  }

  function stop() {
    running = false;
    if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    analyser = null;
  }

  function info() {
    return { running, noteCount, lastNote, noiseFloor: +noiseFloor.toExponential(2) };
  }

  /* share the app's AudioContext (declared in index.html IIFE before this file runs —
     we re-derive it defensively) */
  let actx = null;
  function ensureCtx() {
    if (!actx) {
      // index.html exposes its ctx via window.__op.ctx when available
      actx = (window.__op && window.__op.ctx) || new (window.AudioContext || window.webkitAudioContext)();
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  window.Mic = { start, stop, info, isEcho, stampEcho, useContext:(c)=>{ actx=c; } };

  /* ---- polyphonic chord detection (MusicSense-lite) ----
   * For chord songs: instead of ACF (monophonic), correlate the buffer
   * against each expected chord tone and confirm when ALL of them show a
   * strong peak within the same window. Returns matched midis. */
  function detectChord(buf, sampleRate, candidateMidis){
    const matched=[];
    candidateMidis.forEach(m=>{
      const f=440*Math.pow(2,(m-69)/12);
      const period=Math.round(sampleRate/f);
      if(period<2 || period>buf.length/2) return;
      let sum=0,n=0;
      for(let i=0;i<buf.length-period-1;i+=2){ sum+=buf[i]*buf[i+period]; n++; }
      const corr=sum/(n||1);
      // rms for normalization
      let rms=0; for(let i=0;i<buf.length;i+=2) rms+=buf[i]*buf[i];
      rms=Math.sqrt(rms/(buf.length/2));
      const norm=corr/(rms*rms+1e-9);
      if(norm>0.5 && rms>0.004) matched.push({midi:m, strength:norm});
    });
    return matched;
  }
  window.Mic.detectChord = detectChord;
})();
