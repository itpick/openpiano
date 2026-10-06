/* OpenPiano — Salamander grand piano sampler (real samples, ~3.7MB).
 * 30 velocity-1 samples cover 21..108 by nearest-pitch mapping. Loaded lazily
 * on first user gesture; decodeAudioData on the app AudioContext; playback
 * with playbackRate = 2^((midi - sampleRoot)/12) for pitch shift.
 * Exposed as window.Sampler: { preload(), noteOn(midi)->voice, allLoaded() }
 * MIT-licensed Salamander samples via Tone.js CDN mirror (bundled locally).
 */
(() => {
  "use strict";
  const MAP = {"21":"./samples/A0.ogg","22":"./samples/A0.ogg","23":"./samples/A0.ogg","24":"./samples/A0.ogg","25":"./samples/Ds1.mp3","26":"./samples/Fs1.mp3","27":"./samples/Fs1.mp3","28":"./samples/Fs1.mp3","29":"./samples/C1.ogg","30":"./samples/C1.ogg","31":"./samples/C1.ogg","32":"./samples/C1.ogg","33":"./samples/C1.ogg","34":"./samples/A1.ogg","35":"./samples/A1.ogg","36":"./samples/A1.ogg","37":"./samples/Ds2.mp3","38":"./samples/Fs2.mp3","39":"./samples/Fs2.mp3","40":"./samples/Fs2.mp3","41":"./samples/C2.ogg","42":"./samples/C2.ogg","43":"./samples/C2.ogg","44":"./samples/C2.ogg","45":"./samples/C2.ogg","46":"./samples/A2.ogg","47":"./samples/A2.ogg","48":"./samples/A2.ogg","49":"./samples/Ds3.mp3","50":"./samples/Fs3.mp3","51":"./samples/Fs3.mp3","52":"./samples/Fs3.mp3","53":"./samples/C3.ogg","54":"./samples/C3.ogg","55":"./samples/C3.ogg","56":"./samples/C3.ogg","57":"./samples/C3.ogg","58":"./samples/A3.ogg","59":"./samples/A3.ogg","60":"./samples/A3.ogg","61":"./samples/Ds4.mp3","62":"./samples/Fs4.mp3","63":"./samples/Fs4.mp3","64":"./samples/Fs4.mp3","65":"./samples/C4.ogg","66":"./samples/C4.ogg","67":"./samples/C4.ogg","68":"./samples/C4.ogg","69":"./samples/C4.ogg","70":"./samples/A4.ogg","71":"./samples/A4.ogg","72":"./samples/A4.ogg","73":"./samples/Ds5.mp3","74":"./samples/Fs5.mp3","75":"./samples/Fs5.mp3","76":"./samples/Fs5.mp3","77":"./samples/C5.ogg","78":"./samples/C5.ogg","79":"./samples/C5.ogg","80":"./samples/C5.ogg","81":"./samples/C5.ogg","82":"./samples/A5.ogg","83":"./samples/A5.ogg","84":"./samples/A5.ogg","85":"./samples/Ds6.mp3","86":"./samples/Fs6.mp3","87":"./samples/Fs6.mp3","88":"./samples/Fs6.mp3","89":"./samples/C6.ogg","90":"./samples/C6.ogg","91":"./samples/C6.ogg","92":"./samples/C6.ogg","93":"./samples/C6.ogg","94":"./samples/A6.ogg","95":"./samples/A6.ogg","96":"./samples/A6.ogg","97":"./samples/Ds7.mp3","98":"./samples/Fs7.mp3","99":"./samples/Fs7.mp3","100":"./samples/Fs7.mp3","101":"./samples/C7.ogg","102":"./samples/C7.ogg","103":"./samples/C7.ogg","104":"./samples/C7.ogg","105":"./samples/C7.ogg","106":"./samples/A7.ogg","107":"./samples/A7.ogg","108":"./samples/A7.ogg"};
  const buffers = new Map();   // midi -> AudioBuffer
  let loading = null;

  function ctx(){ return (window.__op && window.__op.ctx) || (window.__op && window.__op.ensureCtx && window.__op.ensureCtx()); }

  function load(midi){
    const c = ctx(); if(!c) return Promise.resolve();
    const url = MAP[String(midi)];
    if(buffers.has(midi) || !url) return Promise.resolve();
    return fetch(url).then(r => r.arrayBuffer())
      .then(ab => c.decodeAudioData(ab))
      .then(buf => buffers.set(midi, buf))
      .catch(()=>{});
  }

  function preload(){
    if(loading) return loading;
    if(!ctx()) { loading = Promise.resolve(); return loading; }
    const c = ctx();
    // fetch in small batches to avoid blocking the lesson
    const midis = Array.from({length:88}, (_,i)=>21+i);
    loading = (async () => {
      const BATCH = 6;
      for(let i=0;i<midis.length;i+=BATCH){
        await Promise.all(midis.slice(i,i+BATCH).map(load));
      }
    })();
    return loading;
  }

  function noteOn(midi, durSecs, bpm){
    const c = ctx(); if(!c) return;
    // nearest loaded sample
    let root = midi;
    while(root >= 21 && !buffers.has(root)) root--;
    if(root < 21) root = midi;
    const buf = buffers.get(root);
    if(!buf) return;  // not loaded yet — silent (caller can fall back to synth)
    const rate = Math.pow(2, (midi - root)/12);
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; src.playbackRate.value = rate;
    const now = c.currentTime;
    g.gain.setValueAtTime(0.9, now);
    if(durSecs){
      g.gain.setValueAtTime(0.75, now + durSecs*0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, now + durSecs + 0.4);
    }
    src.connect(g); g.connect(master0());
    src.start(now);
    src.stop(now + (durSecs ? durSecs + 0.5 : buf.duration/rate));
    return { stop(t){ try{ g.gain.setTargetAtTime(0.0001, c.currentTime, 0.06); src.stop(c.currentTime+0.3);}catch(e){} } };
  }
  function master0(){
    // route through the app's master gain so volume/ducking applies
    return (window.__op && window.__op.master) || c().destination;
  }
  function allLoaded(){ return buffers.size >= 88; }

  window.Sampler = { preload, noteOn, allLoaded, get loadedCount(){ return buffers.size; } };
})();
