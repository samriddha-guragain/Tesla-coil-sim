import { useState, useEffect, useRef, useCallback } from "react";

// ─── Physics ──────────────────────────────────────────────────────────────────
function resonantFreq(L_uH, C_pF) {
  const L = L_uH * 1e-6, C = C_pF * 1e-12;
  return (L > 0 && C > 0) ? 1 / (2 * Math.PI * Math.sqrt(L * C)) : 0;
}
function voltMult(Np, Ns, k) { return (Ns / Np) * k * 0.92; }
function breakKV(g) { return g * 3.0; }
function coilR(turns, awg) {
  const d = 0.127 * Math.pow(92, (36 - awg) / 39) / 1000;
  return (1.68e-8 * turns * 0.15) / (Math.PI * (d / 2) ** 2);
}
function skinD(freq) {
  return freq > 0 ? Math.sqrt(1.68e-8 / (Math.PI * freq * 4e-7)) * 1000 : 999;
}
function qualF(L_uH, C_pF, R) {
  const w = 2 * Math.PI * resonantFreq(L_uH, C_pF);
  return R > 0 ? Math.min((w * L_uH * 1e-6) / R, 9999) : 9999;
}
function wheelerInductance(turns, secondaryRadius, coilHeight_cm) {
  const r = secondaryRadius * 100;
  const l = coilHeight_cm;
  return (r * r * turns * turns) / (9 * r + 10 * l);
}
function wireCalc(primaryTurns, secondaryTurns, wireGauge) {
  const dia = 0.127 * Math.pow(92, (36 - wireGauge) / 39);
  const primaryLen = primaryTurns * 2 * Math.PI * 0.045;
  const secondaryLen = secondaryTurns * 2 * Math.PI * 0.0275;
  const turnSpacing = dia * 1.1 / 1000;
  const coilHeight = secondaryTurns * turnSpacing * 100;
  const L_uH = wheelerInductance(secondaryTurns, 0.0275, coilHeight);
  return { primaryLen, secondaryLen, dia, coilHeight, L_uH };
}

function getMetrics(P) {
  const wc = wireCalc(P.primaryTurns, P.secondaryTurns, P.wireGauge);
  const freq = resonantFreq(wc.L_uH, P.topCapacitance);
  const mult = voltMult(P.primaryTurns, P.secondaryTurns, P.couplingK);
  const outV = P.inputVoltage * mult;
  const outKV = outV / 1000;
  const bkKV = breakKV(P.sparkGapMM);
  const sparking = outKV > bkKV;
  const sparkI = sparking ? Math.min((outKV - bkKV) / 100, 1) : 0;
  const R = coilR(P.secondaryTurns, P.wireGauge);
  return {
    freq, mult, outV, outKV, bkKV, sparking, sparkI, R,
    Q: qualF(wc.L_uH, P.topCapacitance, R),
    delta: skinD(freq), wc,
  };
}

// ─── Format ───────────────────────────────────────────────────────────────────
const fmtF = f => f >= 1e6 ? `${(f/1e6).toFixed(3)} MHz` : f >= 1e3 ? `${(f/1e3).toFixed(1)} kHz` : `${f.toFixed(0)} Hz`;
const fmtV = v => v >= 1e6 ? `${(v/1e6).toFixed(2)} MV` : v >= 1e3 ? `${(v/1e3).toFixed(1)} kV` : `${v.toFixed(0)} V`;
const fmtFS = f => f >= 1e6 ? `${(f/1e6).toFixed(1)}M` : f >= 1e3 ? `${(f/1e3).toFixed(0)}k` : `${f.toFixed(0)}`;

// ─── Canvas ─────────────────────────────────────────────────────────────
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const lerp = (a, b, t) => a + (b - a) * t;

function bolt(ctx, x1, y1, x2, y2, { s=12,j=20,col='#00eeff',a=0.9,lw=1.5,gl=15,br=0 } = {}) {
  const pts = [[x1,y1]];
  for (let i=1;i<s;i++) pts.push([lerp(x1,x2,i/s)+rand(-j,j), lerp(y1,y2,i/s)+rand(-j,j)]);
  pts.push([x2,y2]);
  ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=lw;
  ctx.shadowColor=col; ctx.shadowBlur=gl; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  pts.slice(1).forEach(([x,y])=>ctx.lineTo(x,y)); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=lw*0.3; ctx.shadowBlur=0;
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  pts.slice(1).forEach(([x,y])=>ctx.lineTo(x,y)); ctx.stroke();
  for (let b=0;b<br;b++) {
    const bi=Math.floor(rand(2,pts.length-2)), [bx,by]=pts[bi];
    const ang=Math.atan2(y2-y1,x2-x1)+rand(-0.8,0.8), len=rand(20,55);
    bolt(ctx,bx,by,bx+Math.cos(ang)*len,by+Math.sin(ang)*len,{s:5,j:7,col,a:a*0.5,lw:lw*0.5,gl:gl*0.4,br:0});
  }
  ctx.restore();
}

function drawToroid(ctx, cx, cy, Rx, Ry, rx, col, glow) {
  ctx.save();
  for (let i=0;i<60;i++) {
    const th=(i/60)*Math.PI*2, x=cx+Rx*Math.cos(th), y=cy+Ry*Math.sin(th);
    const r=rx*(0.7+0.3*Math.abs(Math.cos(th)));
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,col+'ff'); g.addColorStop(0.5,col+'77'); g.addColorStop(1,col+'00');
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=g; ctx.globalAlpha=0.35+glow*0.4; ctx.fill();
  }
  ctx.globalAlpha=0.85+glow*0.15; ctx.strokeStyle=col; ctx.lineWidth=2.5;
  ctx.shadowColor=col; ctx.shadowBlur=10+glow*30;
  ctx.beginPath(); ctx.ellipse(cx,cy,Rx,Ry,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawHelix(ctx, cx, cy, w, h, turns, col, lbl) {
  const total = turns * 40;
  ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=1.6;
  ctx.shadowColor=col; ctx.shadowBlur=7; ctx.globalAlpha=0.85;
  let px=null, py=null;
  for (let i=0;i<=total;i++) {
    const t=i/total, ang=t*turns*Math.PI*2;
    const x=cx+(w/2)*Math.cos(ang), y=cy-h/2+h*t;
    if (Math.cos(ang)>-0.2&&px!==null) { ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke(); }
    px=x; py=y;
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;
  ctx.fillStyle=col+'99'; ctx.font="bold 10px 'Share Tech Mono'";
  ctx.textAlign='center'; ctx.fillText(lbl,cx,cy-h/2-10);
  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TeslaCoilSim() {
  const canvasRef = useRef(null);
  const graphRef  = useRef(null);
  const animRef   = useRef(null);
  const frameRef  = useRef(0);
  const particles = useRef([]);

  const [running, setRunning]   = useState(false);
  const [activeTab, setActiveTab] = useState("params");
  const [graphReadout, setGraphReadout] = useState("f₀ = —");

  const [P, setP] = useState({
    primaryTurns: 5, secondaryTurns: 800, topCapacitance: 60,
    couplingK: 0.15, inputVoltage: 9000, sparkGapMM: 3, wireGauge: 22,
  });

  const [status, setStatus]   = useState({ text: "STANDBY", sparking: false, outV: 0, sparkI: 0 });
  const [metrics, setMetrics] = useState({});
  const [wires, setWires]     = useState({});

  const update = (key, val) => setP(p => ({ ...p, [key]: parseFloat(val) }));

  // Recompute metrics when params change
  useEffect(() => {
    const m = getMetrics(P);
    setMetrics(m);
    setWires(m.wc);
    drawFreqGraph(m);
  }, [P]);

  // Draw frequency response graph
  const drawFreqGraph = useCallback((m) => {
    const gc = graphRef.current;
    if (!gc || !m) return;
    const gctx = gc.getContext('2d');
    const GW = gc.width, GH = gc.height;

    gctx.fillStyle = '#02040a';
    gctx.fillRect(0, 0, GW, GH);

    gctx.strokeStyle = 'rgba(0,255,140,0.06)'; gctx.lineWidth = 1;
    for (let i=0;i<=4;i++) {
      const y=(i/4)*GH;
      gctx.beginPath(); gctx.moveTo(0,y); gctx.lineTo(GW,y); gctx.stroke();
    }

    const f0 = m.freq, Q = Math.min(m.Q, 200);
    const fMin = f0*0.3, fMax = f0*1.7;

    gctx.beginPath(); gctx.strokeStyle='#00eeff'; gctx.lineWidth=1.5;
    gctx.shadowColor='#00eeff'; gctx.shadowBlur=6;
    for (let x=0;x<=GW;x++) {
      const f=fMin+(x/GW)*(fMax-fMin);
      const denom=1+Q*Q*Math.pow((f/f0)-(f0/f),2);
      const y=GH-(1/denom)*(GH-6)-3;
      x===0?gctx.moveTo(x,y):gctx.lineTo(x,y);
    }
    gctx.stroke(); gctx.shadowBlur=0;

    gctx.beginPath();
    for (let x=0;x<=GW;x++) {
      const f=fMin+(x/GW)*(fMax-fMin);
      const denom=1+Q*Q*Math.pow((f/f0)-(f0/f),2);
      const y=GH-(1/denom)*(GH-6)-3;
      x===0?gctx.moveTo(x,y):gctx.lineTo(x,y);
    }
    gctx.lineTo(GW,GH); gctx.lineTo(0,GH); gctx.closePath();
    gctx.fillStyle='rgba(0,238,255,0.04)'; gctx.fill();

    const px = GW/2;
    gctx.strokeStyle='rgba(0,238,255,0.4)'; gctx.lineWidth=1; gctx.setLineDash([3,4]);
    gctx.beginPath(); gctx.moveTo(px,0); gctx.lineTo(px,GH); gctx.stroke();
    gctx.setLineDash([]);

    if (m.sparking) {
      gctx.fillStyle='rgba(255,68,68,0.15)'; gctx.fillRect(px-20,0,40,GH);
      gctx.fillStyle='#ff444488'; gctx.font="7px 'Share Tech Mono'";
      gctx.textAlign='center'; gctx.fillText('SPARK',px,GH-4);
    }

    gctx.fillStyle='rgba(0,255,140,0.25)'; gctx.font="7px 'Share Tech Mono'";
    gctx.textAlign='left'; gctx.fillText(`${fmtFS(fMin)}Hz`,2,GH-3);
    gctx.textAlign='right'; gctx.fillText(`${fmtFS(fMax)}Hz`,GW-2,GH-3);
    gctx.textAlign='center'; gctx.fillStyle='rgba(0,238,255,0.5)';
    gctx.fillText('f₀',px,9);

    setGraphReadout(`f₀ = ${fmtF(f0)}  ·  Q = ${Math.min(m.Q,9999).toFixed(0)}  ·  BW = ${fmtF(f0/Math.max(m.Q,1))}`);
  }, []);

  // Main canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const CCX=W*0.5, PCY=H*0.78, SCY=H*0.5, TCY=H*0.17, GY=H*0.91;

    function spawnP(cx, cy, si) {
      for (let i=0;i<Math.floor(3+si*7);i++) {
        const a=rand(0,Math.PI*2), sp=rand(0.5,3+si*3);
        particles.current.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-rand(0,1.5),life:1,decay:rand(0.02,0.05),sz:rand(1,2.5)});
      }
    }

    function drawFrame() {
      frameRef.current++;
      const f = frameRef.current;
      const m = getMetrics(P);

      ctx.fillStyle='#02040a'; ctx.fillRect(0,0,W,H);
      const vig=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.9);
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.65)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

      ctx.save(); ctx.strokeStyle='rgba(0,255,100,0.04)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      ctx.restore();

      ctx.save(); ctx.strokeStyle='#00ff8c'; ctx.lineWidth=2; ctx.shadowColor='#00ff8c'; ctx.shadowBlur=6;
      for(let i=0;i<4;i++){const w=60-i*14;ctx.globalAlpha=1-i*0.22;ctx.beginPath();ctx.moveTo(CCX-w/2,GY+i*6);ctx.lineTo(CCX+w/2,GY+i*6);ctx.stroke();}
      ctx.restore();

      drawHelix(ctx,CCX,PCY,90,55,P.primaryTurns,'#ff9500',`PRIMARY ${P.primaryTurns}T`);
      drawHelix(ctx,CCX,SCY,55,120,Math.min(P.secondaryTurns,28),'#00c8ff',`SECONDARY ${P.secondaryTurns}T`);

      ctx.save(); ctx.strokeStyle='rgba(0,200,255,0.25)'; ctx.lineWidth=1.5; ctx.setLineDash([4,6]);
      ctx.beginPath(); ctx.moveTo(CCX,SCY-62); ctx.lineTo(CCX,TCY+16); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();

      const gp = running?0.5+0.5*Math.sin(f*0.08):0.1;
      drawToroid(ctx,CCX,TCY,44,14,10,'#00eeff',gp*(m.sparking?m.sparkI:0.2));

      if (running && m.sparking) {
        for(let r=0;r<3;r++){
          const age=((f+r*20)%60)/60, rad=age*110, alpha=(1-age)*0.14*m.sparkI;
          ctx.save(); ctx.strokeStyle=`rgba(0,200,255,${alpha})`; ctx.lineWidth=1;
          ctx.beginPath(); ctx.ellipse(CCX,TCY,rad,rad*0.35,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
        }
        const na=1+Math.floor(m.sparkI*5);
        for(let i=0;i<na;i++){
          if(Math.random()>0.4){
            const ang=rand(-Math.PI*0.9,-Math.PI*0.1), len=rand(40,80+m.sparkI*120);
            const ex=CCX+Math.cos(ang)*len, ey=TCY+Math.sin(ang)*len*0.7;
            bolt(ctx,CCX+rand(-20,20),TCY,ex,ey,{s:10+Math.floor(m.sparkI*8),j:12+m.sparkI*20,col:'#00eeff',a:rand(0.5,0.95),lw:rand(0.8,1.8+m.sparkI),gl:12+m.sparkI*20,br:Math.random()>0.55?Math.floor(m.sparkI*3):0});
            if(Math.random()>0.7) spawnP(ex,ey,m.sparkI);
          }
        }
        if(Math.random()>0.97) bolt(ctx,CCX,TCY,CCX+rand(-15,15),GY,{s:20,j:25,col:'#ffffff',a:0.6,lw:2,gl:28,br:2});
      }

      for(let i=particles.current.length-1;i>=0;i--){
        const p=particles.current[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life-=p.decay;
        if(p.life<=0){particles.current.splice(i,1);continue;}
        ctx.save(); ctx.globalAlpha=p.life; ctx.fillStyle='#00eeff'; ctx.shadowColor='#00eeff'; ctx.shadowBlur=4;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.sz*p.life,0,Math.PI*2); ctx.fill(); ctx.restore();
      }

      const sgx=CCX-100, sgy=PCY-10, ge=sgx+4+P.sparkGapMM*1.5;
      ctx.save(); ctx.strokeStyle='#ff4444'; ctx.lineWidth=2; ctx.shadowColor='#ff4444'; ctx.shadowBlur=6;
      ctx.beginPath(); ctx.moveTo(sgx-18,sgy); ctx.lineTo(sgx-4,sgy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ge,sgy); ctx.lineTo(ge+16,sgy); ctx.stroke();
      ctx.fillStyle='#ff4444';
      ctx.beginPath(); ctx.arc(sgx-4,sgy,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ge,sgy,3,0,Math.PI*2); ctx.fill();
      if(running&&m.sparking&&Math.random()>0.3) bolt(ctx,sgx-4,sgy,ge,sgy,{s:5,j:5,col:'#ff6644',a:rand(0.6,1),lw:1.5,gl:12});
      ctx.fillStyle='rgba(255,68,68,0.5)'; ctx.font="9px 'Share Tech Mono'"; ctx.textAlign='center';
      ctx.fillText(`${P.sparkGapMM}mm`,sgx+P.sparkGapMM*0.75,sgy+18); ctx.restore();

      const oy=H*0.965;
      ctx.save(); ctx.strokeStyle='#00ff8c'; ctx.lineWidth=1.2;
      ctx.shadowColor='#00ff8c'; ctx.shadowBlur=running?6:2; ctx.globalAlpha=0.65;
      ctx.beginPath();
      for(let x=0;x<=W-24;x++){
        const t=x/(W-24), ph=t*Math.PI*12+f*(running?0.18:0);
        const amp=running?(4+m.sparkI*10)*Math.sin(t*Math.PI):1.5;
        x===0?ctx.moveTo(12+x,oy+Math.sin(ph)*amp):ctx.lineTo(12+x,oy+Math.sin(ph)*amp);
      }
      ctx.stroke(); ctx.restore();

      if(running){
        const pulse=0.5+0.5*Math.sin(f*0.15);
        ctx.save();
        ctx.fillStyle=m.sparking?`rgba(0,238,255,${0.6+pulse*0.4})`:`rgba(0,255,140,${0.4+pulse*0.3})`;
        ctx.shadowColor=m.sparking?'#00eeff':'#00ff8c'; ctx.shadowBlur=10+pulse*10;
        ctx.beginPath(); ctx.arc(W-16,16,5,0,Math.PI*2); ctx.fill(); ctx.restore();
      }

      setStatus({ text: running ? (m.sparking ? `SPARKING · ${fmtV(m.outV)} OUTPUT` : 'RUNNING · BELOW THRESHOLD') : 'STANDBY', sparking: m.sparking && running, outV: m.outV, sparkI: m.sparkI });

      animRef.current = requestAnimationFrame(drawFrame);
    }

    animRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, [running, P]);

  const controls = [
    { key:"primaryTurns",   label:"PRIMARY TURNS",   min:3,    max:15,    step:1,    unit:"T",   color:"#ff9500" },
    { key:"secondaryTurns", label:"SECONDARY TURNS", min:100,  max:1500,  step:25,   unit:"T",   color:"#00c8ff" },
    { key:"topCapacitance", label:"TOP CAPACITANCE", min:10,   max:300,   step:5,    unit:"pF",  color:"#ffdd00" },
    { key:"couplingK",      label:"COUPLING k",      min:0.05, max:0.65,  step:0.01, unit:"",    color:"#cc88ff" },
    { key:"inputVoltage",   label:"INPUT VOLTAGE",   min:1000, max:50000, step:500,  unit:"V",   color:"#ff9500" },
    { key:"sparkGapMM",     label:"SPARK GAP",       min:0.5,  max:15,    step:0.5,  unit:"mm",  color:"#ff4444" },
    { key:"wireGauge",      label:"WIRE GAUGE",      min:18,   max:30,    step:1,    unit:"AWG", color:"#88ffcc" },
  ];

  const S = { fontFamily:"'Share Tech Mono', monospace", background:"#02040a", color:"#00ff8c", height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" };

  return (
    <div style={S}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #02040a; }
        input[type=range] { -webkit-appearance:none; appearance:none; width:100%; height:3px; background:rgba(0,255,140,0.2); outline:none; cursor:pointer; border-radius:1px; margin:4px 0; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:white; cursor:pointer; transition:transform 0.15s; box-shadow:0 0 6px currentColor; }
        input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.4); }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(0,255,140,0.15); border-radius:2px; }
        @keyframes flicker { 0%,89%,91%,96%,100%{opacity:1} 90%{opacity:.75} 95%{opacity:.88} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 8px rgba(255,68,68,.3)} 50%{box-shadow:0 0 20px rgba(255,68,68,.7),0 0 40px rgba(255,68,68,.15)} }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderBottom:"1px solid rgba(0,255,140,0.1)", background:"rgba(0,255,140,0.02)", flexShrink:0, animation:"flicker 10s infinite" }}>
        <div>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:900, fontSize:16, letterSpacing:4, color:"#00eeff", textShadow:"0 0 20px rgba(0,238,255,0.5)" }}>TESLA COIL SIMULATOR</div>
          <div style={{ fontSize:9, color:"rgba(0,255,140,0.25)", letterSpacing:2, marginTop:3 }}>RESONANT LC CIRCUIT VISUALIZER · OPEN SOURCE · SAMRIDDHA GURAGAIN</div>
        </div>
        <div style={{ textAlign:"right", fontSize:9, lineHeight:1.8, color:"rgba(255,149,0,0.5)" }}>
          JHAPA, NEPAL<br/><span style={{ color:"rgba(255,149,0,0.3)" }}>3 ATTEMPTS · 1 WORKING COIL</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Left — canvas + graph + wire calc */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:12, gap:10 }}>
          <canvas ref={canvasRef} width={460} height={420} style={{ border:"1px solid rgba(0,255,140,0.08)", borderRadius:3 }} />

          {/* Frequency graph */}
          <div style={{ width:460, background:"#02040a", border:"1px solid rgba(0,255,140,0.08)", borderRadius:3, padding:"10px 12px 8px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:8, letterSpacing:2, color:"rgba(0,255,140,0.4)" }}>FREQUENCY RESPONSE — RESONANCE CURVE</span>
              <span style={{ fontSize:9, color:"#00eeff" }}>{graphReadout}</span>
            </div>
            <canvas ref={graphRef} width={436} height={75} style={{ border:"none" }} />
          </div>

          {/* Wire calc */}
          <div style={{ width:460, background:"rgba(0,255,140,0.02)", border:"1px solid rgba(0,255,140,0.08)", borderRadius:3, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            {[
              { label:"PRIMARY WIRE",   val:`${wires.primaryLen?.toFixed(1)||'—'}m`,   color:"#ff9500" },
              { label:"SECONDARY WIRE", val:`${wires.secondaryLen?.toFixed(1)||'—'}m`, color:"#00c8ff" },
              { label:"WIRE DIA",       val:`${wires.dia?.toFixed(2)||'—'}mm`,         color:"#88ffcc" },
              { label:"COIL HEIGHT",    val:`${wires.coilHeight?.toFixed(1)||'—'}cm`,  color:"#ffdd00" },
              { label:"SECONDARY L",    val:`${wires.L_uH?(wires.L_uH/1000).toFixed(1):'—'}mH`, color:"#cc88ff" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ fontSize:7, color:"rgba(0,255,140,0.3)", letterSpacing:1, marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:11, fontWeight:"bold", color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width:280, borderLeft:"1px solid rgba(0,255,140,0.08)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          <button onClick={() => setRunning(r => !r)} style={{ margin:"14px 16px 0", fontFamily:"'Orbitron',sans-serif", fontWeight:700, fontSize:12, letterSpacing:3, padding:12, background:running?"rgba(255,68,68,0.08)":"rgba(0,238,255,0.06)", border:`1px solid ${running?"rgba(255,68,68,0.6)":"rgba(0,238,255,0.5)"}`, color:running?"#ff4444":"#00eeff", cursor:"pointer", borderRadius:2, transition:"all 0.3s", animation:running?"pulseGlow 2s infinite":"none" }}>
            {running ? "◼  SHUTDOWN" : "▶  ENERGIZE"}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:6, margin:"10px 16px 0", fontSize:9, letterSpacing:1, color:status.sparking?"#00eeff":running?"rgba(0,255,140,0.6)":"rgba(0,255,140,0.25)" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:status.sparking?"#00eeff":running?"#00ff8c":"#333", boxShadow:status.sparking?"0 0 8px #00eeff":running?"0 0 6px #00ff8c":"none", flexShrink:0 }} />
            {status.text}
          </div>

          {running && (
            <div style={{ margin:"8px 16px 14px" }}>
              <div style={{ fontSize:8, color:"rgba(0,255,140,0.25)", letterSpacing:1, marginBottom:4 }}>SPARK INTENSITY</div>
              <div style={{ height:3, background:"#0a1a0a", borderRadius:2 }}>
                <div style={{ height:"100%", width:`${status.sparkI*100}%`, background:status.sparkI>0.7?"#ff4444":status.sparkI>0.3?"#ff9500":"#00eeff", borderRadius:2, transition:"width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid rgba(0,255,140,0.08)" }}>
            {["params","physics"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex:1, padding:8, fontSize:8, letterSpacing:2, fontFamily:"'Share Tech Mono',monospace", background:activeTab===tab?"rgba(0,255,140,0.05)":"transparent", border:"none", borderBottom:activeTab===tab?"1px solid #00ff8c":"1px solid transparent", color:activeTab===tab?"#00ff8c":"rgba(0,255,140,0.3)", cursor:"pointer", textTransform:"uppercase", marginBottom:-1 }}>
                {tab === "params" ? "PARAMETERS" : "PHYSICS"}
              </button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
            {activeTab === "params" ? (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {controls.map(({ key, label, min, max, step, unit, color }) => (
                  <div key={key} style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:8, color:"rgba(0,255,140,0.4)", letterSpacing:1 }}>{label}</span>
                      <span style={{ fontSize:11, fontWeight:"bold", color }}>{P[key]}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={P[key]} onChange={e => update(key, e.target.value)} style={{ accentColor: color }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {[
                  { label:"RESONANT FREQ",   val:fmtF(metrics.freq||0),                    color:"#00eeff" },
                  { label:"OUTPUT VOLTAGE",  val:fmtV(metrics.outV||0),                    color:metrics.sparking?"#ff4444":"#ff9500" },
                  { label:"VOLT MULTIPLIER", val:`${(metrics.mult||0).toFixed(0)}×`,        color:"#ffdd00" },
                  { label:"SPARK THRESHOLD", val:`${(metrics.bkKV||0).toFixed(1)} kV`,     color:"#ff4444" },
                  { label:"QUALITY FACTOR Q",val:`${Math.min(metrics.Q||0,9999).toFixed(0)}`, color:"#cc88ff" },
                  { label:"SKIN DEPTH δ",    val:`${(metrics.delta||0).toFixed(3)} mm`,    color:"#88ffcc" },
                  { label:"COIL RESISTANCE", val:`${((metrics.R||0)*1000).toFixed(1)} mΩ`, color:"#aaaaaa" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid rgba(0,255,140,0.05)" }}>
                    <span style={{ fontSize:8, color:"rgba(0,255,140,0.3)", letterSpacing:1 }}>{label}</span>
                    <span style={{ fontSize:12, fontWeight:"bold", color }}>{val}</span>
                  </div>
                ))}
                <div style={{ marginTop:12, fontSize:8, color:"rgba(0,255,140,0.15)", lineHeight:2, borderTop:"1px solid rgba(0,255,140,0.05)", paddingTop:12 }}>
                  <div style={{ color:"rgba(0,255,140,0.35)", marginBottom:6, letterSpacing:1 }}>EQUATIONS</div>
                  f = 1 / (2π√LC)<br/>V_out = V_in · (Ns/Np) · k<br/>V_bd ≈ 3 kV/mm (air)<br/>Q = ωL / R<br/>δ = √(ρ / πfμ)
                </div>
                <div style={{ marginTop:12, padding:10, background:"rgba(0,238,255,0.03)", border:"1px solid rgba(0,238,255,0.08)", borderRadius:2, fontSize:8, color:"rgba(0,238,255,0.25)", lineHeight:1.9, fontStyle:"italic" }}>
                  "Got shocked too much and too<br/>frequently on attempt two.<br/>Built it anyway. Third time —<br/>the bulb glowed."<br/>
                  <span style={{ color:"rgba(0,238,255,0.15)" }}>— Grade 9, Jhapa, Nepal</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
