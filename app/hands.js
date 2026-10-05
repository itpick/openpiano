/* OpenPiano — hands overlay (Phase: hands).
 * Simplified port of simpli-piano's hands.js concept: two semi-transparent SVG
 * hands over the keyboard, numbered fingertip badges (thumb 1 … pinky 5), the
 * target finger lights with the key highlight. Default OFF (hard UX rule from
 * the research: "hands must always start OFF — the user turns them on").
 * Exposed as window.Hands: { mount(kbEl), setHighlight(midi|null), show(bool), visible }
 */
(() => {
  "use strict";
  const SVGNS="http://www.w3.org/2000/svg";

  /* Right-hand template: fingertip x positions across the 5-key span (0..1),
     drawn for RH; LH is mirrored. Thumb at the left for RH. */
  const TIPS=[
    {x:0.06,y:0.30,n:1}, // thumb
    {x:0.28,y:0.10,n:2},
    {x:0.50,y:0.04,n:3},
    {x:0.72,y:0.12,n:4},
    {x:0.94,y:0.30,n:5}, // pinky
  ];

  let svg=null, visible=false, currentHl=null;
  let badges={}; // n → element

  function el(name,attrs){ const e=document.createElementNS(SVGNS,name);
    for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }

  function buildHand(container, mirror){
    const g=el("g",{});
    if(mirror) g.setAttribute("transform","scale(-1,1) translate(-160,0)");
    // palm: rounded shape
    g.append(el("path",{d:"M30,90 Q30,40 80,40 L130,40 Q150,40 148,70 L146,88 Q120,98 88,96 Q50,96 30,90 Z",
      fill:"rgba(122,162,255,0.16)", stroke:"rgba(122,162,255,0.45)","stroke-width":1.5}));
    // fingers: tapered capsules from palm top to tips
    const FINGERS=[
      {bx:40,by:78,tx:22,ty:26,w:13},{bx:70,by:48,tx:62,ty:8,w:11},
      {bx:96,by:44,tx:96,ty:2,w:11},{bx:120,by:48,tx:126,ty:10,w:10},
      {bx:142,by:66,tx:150,ty:28,w:9}
    ];
    FINGERS.forEach(f=>{
      g.append(el("path",{
        d:`M${f.bx-f.w},${f.by} Q${f.tx-4},${f.ty-6} ${f.tx},${f.ty} Q${f.tx+4},${f.ty-6} ${f.bx+f.w},${f.by} Z`,
        fill:"rgba(122,162,255,0.16)", stroke:"rgba(122,162,255,0.45)","stroke-width":1.5}));
    });
    // numbered fingertip badges
    TIPS.forEach(t=>{
      const cx=mirror? 160-(t.x*160) : t.x*160;
      const cy=t.y*90+6;
      const c=el("circle",{cx,cy,r:8,fill:"rgba(102,217,196,0.25)",stroke:"#66d9c4","stroke-width":1.2});
      const tx=el("text",{x:cx,y:cy+3.5,"text-anchor":"middle","font-size":9,
        fill:"#66d9c4","font-weight":700});
      tx.textContent=t.n;
      badges[t.n]=c;
      g.append(c); g.append(tx);
    });
    return g;
  }

  function mount(kbEl){
    // overlay positioned over the keyboard
    const wrap=document.createElement("div");
    wrap.style.cssText="position:relative";
    kbEl.parentNode.insertBefore(wrap,kbEl);
    wrap.append(kbEl);
    svg=el("svg",{viewBox:"0 0 160 96", preserveAspectRatio:"none"});
    svg.style.cssText="position:absolute;bottom:0;left:0;width:100%;height:78%;"+
      "pointer-events:none;display:none;z-index:3";
    svg.append(buildHand(svg,false));   // left hand at left edge
    const rh=buildHand(svg,true);       // right hand mirrored at right edge
    rh.setAttribute("transform","translate(160,0) scale(-1,1) translate(0,0)");
    // reposition: RH occupies right half
    rh.setAttribute("transform","scale(-1,1) translate(-160,0)");
    svg.append(rh);
    wrap.append(svg);
    applyVisibility();
  }

  function applyVisibility(){ if(svg) svg.style.display=visible?"block":"none"; }
  function show(v){ visible=v; applyVisibility(); }
  /** Light the badge(s) for the key being highlighted. Map midi→finger by
   * position in the five-finger span (C=1 thumb … G=5 pinky for RH). */
  function setHighlight(midi){
    // reset all
    Object.values(badges).forEach(c=>{ c.setAttribute("fill","rgba(102,217,196,0.25)"); c.setAttribute("r",8); });
    if(midi==null) return;
    const pc=((midi%12)+12)%12;
    const finger={0:1,2:2,4:3,5:4,7:5}[pc]; // C D E F G → 1..5
    if(finger && badges[finger]){
      badges[finger].setAttribute("fill","rgba(102,217,196,0.85)");
      badges[finger].setAttribute("r",10);
    }
  }

  window.Hands={ mount, setHighlight, show, get visible(){ return visible; } };
})();
