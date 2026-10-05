/* OpenPiano — staff rendering + note-reading trainer (Phase D).
 *
 * Staff geometry mirrors simpli-piano's trainer.js: treble bottom line = E4,
 * bass bottom line = G2, one SVG viewBox, notes drawn as filled ellipses with
 * ledger lines. Drill: show one note, learner plays the matching key, color
 * feedback, expanding range as the streak grows, timed tests with notes/min.
 * Exposed as window.Staff.
 */
(() => {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";

  // pitch class → diatonic ordinal (C=0 D=1 E=2 F=3 G=4 A=5 B=6), naturals only
  const PC_ORD = {0:0, 2:1, 4:2, 5:3, 7:4, 9:5, 11:6};
  const isNatural = m => PC_ORD[((m%12)+12)%12] !== undefined;
  const diatonic = m => (Math.floor(m/12)-1)*7 + PC_ORD[((m%12)+12)%12];

  const GAP=12, HALF=6, E4_DI=4*7+2, E4_Y=120, G2_DI=2*7+4;
  const noteY=(m,clef)=> E4_Y - (diatonic(m)-(clef==="bass"?G2_DI:E4_DI))*HALF;

  const NAMES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const letter=m=>NAMES[m%12];

  function makeSvg(w,h){
    const svg=document.createElementNS(SVGNS,"svg");
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
    svg.style.width="100%"; svg.style.maxHeight=h+"px"; svg.style.display="block";
    return svg;
  }
  function el(name, attrs){
    const e=document.createElementNS(SVGNS,name);
    for(const k in attrs) e.setAttribute(k,attrs[k]);
    return e;
  }

  /** Draw a staff with one note. clef: "treble"|"bass". Returns svg element. */
  function drawNote(midi, clef){
    const svg=makeSvg(300,180);
    // 5 staff lines
    const bottom=noteY(clef==="bass"?G2_DI+ (0):48, clef); // anchor: bottom line y
    const baseY= clef==="bass" ? noteY(G2_DI,clef) : noteY(4*7+0, clef); // bottom line: treble E4=64? no — bottom LINE is the lowest line (E4 for treble is bottom line)
    // treble: bottom line = E4 (diatonic 30). bass: bottom line = G2 (diatonic 18)
    const bottomY = E4_Y;
    for(let i=0;i<5;i++){
      svg.append(el("line",{x1:20,x2:280,y1:bottomY-i*GAP*2/2*0 - i*0, y2:bottomY, stroke:"#9aa3b8","stroke-width":1.4}));
    }
    // redraw properly: lines from bottom (E4_Y) upward
    svg.innerHTML="";
    for(let i=0;i<5;i++){
      const y=bottomY - i*GAP;
      svg.append(el("line",{x1:20,x2:280,y1:y,y2:y,stroke:"#9aa3b8","stroke-width":1.4}));
    }
    // clef glyph (text-based, pragmatic)
    const clefTxt=el("text",{x:26,y:bottomY-3*GAP*0.4,"font-size":clef==="bass"?34:44,fill:"#e8eaf2","font-family":"serif"});
    clefTxt.textContent = clef==="bass"?"𝄢":"𝄞";
    svg.append(clefTxt);
    // ledger lines if needed
    const y=noteY(midi,clef);
    const di=diatonic(midi);
    const refDI= clef==="bass"?G2_DI:E4_DI;
    for(let d=refDI+ (clef==="bass"?7:7); d<=di; d+=2){ // ledger above? compute by line positions
    }
    // ledger lines above/below: staff lines at diatonic positions refDI + 0,2,4,6,8 (even steps up)
    for(let dd=refDI; dd<=di+8; dd+=2){
      if(dd>refDI+8){ // above top line
        const ly=E4_Y-(dd-refDI)*HALF;
        if(dd<=di) svg.append(el("line",{x1:midi? 118:118,x2:162,y1:ly,y2:ly,stroke:"#9aa3b8","stroke-width":1.2}));
      }
    }
    for(let dd=refDI-2; dd>=di; dd-=2){
      const ly=E4_Y-(dd-refDI)*HALF;
      svg.append(el("line",{x1:118,x2:162,y1:ly,y2:ly,stroke:"#9aa3b8","stroke-width":1.2}));
    }
    // note head (natural notes only in drills; accidentals drawn as text)
    svg.append(el("ellipse",{cx:140,cy:y,rx:HALF+2,ry:HALF-1,fill:"#7aa2ff",
      transform:`rotate(-18 140 ${y})`}));
    // stem
    svg.append(el("line",{x1:146,x2:146,y1:y-4,y2:y-52,stroke:"#7aa2ff","stroke-width":2.4}));
    // accidental
    const pc=((midi%12)+12)%12;
    if(pc===1||pc===3||pc===6||pc===8||pc===10){
      const acc=el("text",{x:112,y:y+6,"font-size":24,fill:"#e8eaf2"});
      acc.textContent="♯"; svg.append(acc);
    }
    return svg;
  }

  /* ---------------- the trainer view ---------------- */
  // expanding levels (treble), mirroring simpli-piano trainer.js
  function whiteInRange(lo,hi){ const out=[]; for(let m=lo;m<=hi;m++) if(isNatural(m)) out.push(m); return out; }
  const LEVELS=[whiteInRange(60,67),whiteInRange(60,72),whiteInRange(60,76),whiteInRange(60,84)];

  function trainerView(mountEl, { clef="treble", testNotes=null, timeLimit=null, onDone } = {}){
    mountEl.innerHTML="";
    const wrap=document.createElement("div");
    wrap.style.cssText="background:var(--panel);border:1px solid #2e3548;border-radius:12px;padding:16px;margin-bottom:10px";
    const staffBox=document.createElement("div"); wrap.append(staffBox);
    const status=document.createElement("div");
    status.style.cssText="color:var(--muted);font-size:.9rem;margin:8px 0";
    wrap.append(status);
    mountEl.append(wrap);

    let level=0, correct=0, total=0, streakC=0, cur=null, done=false;
    let startT=null, prompts= testNotes? testNotes.length : Infinity;
    let asked=0, firstTryHits=0, tHandle=null;
    const perUser=(arr)=>{ for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };
    let queue=perUser(LEVELS[level].slice());

    function next(){
      if(done) return;
      if(!queue.length){ queue=perUser(LEVELS[level].slice()); }
      cur=queue.pop(); asked++;
      staffBox.innerHTML=""; staffBox.append(drawNote(cur,clef));
      status.textContent=`note ${asked}${prompts<Infinity?"/"+prompts:""} · level ${level+1} · ✓ ${correct}`;
      if(timeLimit&&startT==null){ startT=performance.now();
        tHandle=setTimeout(()=>{ finish(true); }, timeLimit*1000); }
    }
    function finish(timeout){
      if(done) return; done=true; clearTimeout(tHandle);
      const secs=(performance.now()-startT)/1000;
      const acc= total? correct/total : 0;
      onDone&&onDone({ correct, total, notesPerMin: secs>0?Math.round(total/(secs/60)):0,
        accuracy:acc, timedOut:!!timeout });
    }
    function input(m,down){
      if(!down||done||cur==null) return;
      total++;
      if(m===cur){
        correct++; streakC++;
        status.textContent=`✓ ${letter(cur)} — nice!`;
        // streak expands the range (the "read the note, play the key" idea)
        if(streakC>=6 && level<LEVELS.length-1){ level++; streakC=0; queue=perUser(LEVELS[level].slice()); }
        if(asked>=prompts){ finish(false); return; }
        setTimeout(next,350);
      } else {
        streakC=0;
        status.textContent=`✗ that was ${letter(m)} — try again`;
      }
    }
    next();
    return { input, destroy(){ done=true; clearTimeout(tHandle); } };
  }

  window.Staff={ drawNote, trainerView, whiteInRange, LEVELS, drawSongStrip };

  /** Melody strip: whole song drawn as compact pitch-line on a mini staff. */
  function drawSongStrip(song){
    const W=Math.min(1100, Math.max(600, song.steps.length*26)), H=150;
    const svg=makeSvg(W,H);
    for(let i=0;i<5;i++){
      svg.append(el("line",{x1:10,x2:W-10,y1:40+i*11,y2:40+i*11,stroke:"#3a415a","stroke-width":1}));
    }
    const lo=song.lo, hi=song.hi;
    const yFor=m=>{ const di=diatonic(m); const dTop=diatonic(hi)+2, dBot=diatonic(lo)-2;
      const t=(dTop-di)/Math.max(1,dTop-dBot); return 40-18+t*(H-70); };
    // bar lines every 4 beats
    let beat=0;
    song.steps.forEach((st,i)=>{
      if(st.rest){ beat+=st.beats; return; }
      const midis=Array.isArray(st.midi)?st.midi:[st.midi];
      const x=16+ (beat/song.steps.reduce((a,s)=>a+s.beats,0))*(W-32);
      midis.forEach(m=>{
        svg.append(el("circle",{cx:x,cy:yFor(m),r:3.4,fill: midis.length>1?"#ffd166":"#7aa2ff"}));
      });
      if(Math.abs(beat%4)<0.01 && beat>0){
        svg.append(el("line",{x1:x,x2:x,y1:38,y2:82,stroke:"#3a415a","stroke-width":1}));
      }
      beat+=st.beats;
    });
    return svg;
  }
})();
