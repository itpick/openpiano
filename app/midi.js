/* OpenPiano — Web MIDI input (ported pattern from foxzi/simplepiano's useMidi).
 * Secure-context only (HTTPS/localhost); Chromium browsers. Requests access
 * without SysEx. Selects the first MIDI input and routes note on/off into the
 * same press/release pipeline as touch + mic.
 * Exposed as window.Midi: { available(), start(onNote), stop() }.
 */
(() => {
  "use strict";
  let access = null, input = null, running = false;

  function available(){
    return !!(navigator.requestMIDIAccess);
  }

  async function start(onNote){
    if(!available()) throw new Error("Web MIDI unavailable (needs Chrome/Edge + HTTPS)");
    access = await navigator.requestMIDIAccess({ sysex: false });
    const pick = () => {
      input = null;
      for (const port of access.inputs.values()) { input = port; break; }
      if (input) {
        input.onmidimessage = (msg) => {
          const [status, note, vel] = msg.data;
          const cmd = status & 0xf0;
          if (cmd === 0x90 && vel > 0) onNote(note, true);
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) onNote(note, false);
        };
      }
    };
    pick();
    access.onstatechange = pick; // hot-plug
    running = true;
    return input ? input.name || "MIDI input" : null;
  }

  function stop(){
    if (input) input.onmidimessage = null;
    running = false;
  }

  window.Midi = { available, start, stop, get running(){ return running; } };
})();
