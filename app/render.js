/* OpenPiano — offline piano WAV renderer (for e2e tests).
 *
 * Renders melodies to 16-bit PCM WAV the way a piano would sound to a mic:
 * near-static sustained tone with attack transient and slow decay. The ACF2+
 * detector in mic.js locks onto the fundamental of these tones.
 *
 * Exposed as window.renderWav(steps, bpm) -> ArrayBuffer (audio/wav).
 */
(() => {
  "use strict";

  const SR = 44100;

  function synthVoice(freq, durSecs) {
    // struck piano: sharp attack, FAST decay (audible ~0.5s) — a real hammer
    // strike doesn't ring at full level for the whole note value; fast decay
    // also keeps the mic's echo window clear for fast same-pitch repeats
    const n = Math.floor(durSecs * SR);
    const out = new Float32Array(n);
    const f2 = freq * 2, f3 = freq * 3;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const attack = Math.min(1, t / 0.004);
      const decay = Math.exp(-t * 6) + 0.12 * Math.exp(-t * 1.2); // body + faint tail
      const harm = Math.sin(2 * Math.PI * freq * t)
        + 0.28 * Math.sin(2 * Math.PI * f2 * t) * Math.exp(-t * 8)
        + 0.10 * Math.sin(2 * Math.PI * f3 * t) * Math.exp(-t * 12);
      out[i] = 0.55 * attack * decay * harm;
    }
    return out;
  }

  function renderSteps(steps, bpm) {
    const beat = 60 / bpm;
    let totalSecs = 0;
    steps.forEach(s => { totalSecs += s.beats * beat; });
    totalSecs += 0.5; // tail
    const total = Math.ceil(totalSecs * SR);
    const mix = new Float32Array(total);

    let cursor = 0;
    steps.forEach(s => {
      const durSecs = s.beats * beat;
      if (!s.rest) {
        const midis = Array.isArray(s.midi) ? s.midi : [s.midi];
        midis.forEach(m => {
          const f = 440 * Math.pow(2, (m - 69) / 12);
          const v = synthVoice(f, durSecs * 1.02);
          for (let i = 0; i < v.length && cursor + i < total; i++)
            mix[cursor + i] += v[i] / midis.length;
        });
      }
      cursor += Math.floor(durSecs * SR);
    });

    // normalize
    let peak = 0;
    for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(mix[i]));
    const gain = peak > 0 ? 0.72 / peak : 1;

    // WAV container (16-bit PCM mono)
    const dataSize = total * 2;
    const ab = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(ab);
    const wstr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
    wstr(0, "RIFF"); dv.setUint32(4, 36 + dataSize, true); wstr(8, "WAVE");
    wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, SR, true);
    dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wstr(36, "data"); dv.setUint32(40, dataSize, true);
    for (let i = 0; i < total; i++) {
      const v = Math.max(-1, Math.min(1, mix[i] * gain));
      dv.setInt16(44 + i * 2, v * 32767, true);
    }
    return ab;
  }

  window.renderWav = renderSteps;
})();
