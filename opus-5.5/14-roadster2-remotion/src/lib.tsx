import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig, random } from 'remotion';

/* ------------------------------------------------------------------ *
 * Tesla keynote palette: pure black stage, one saturated red accent. *
 * ------------------------------------------------------------------ */
export const C = {
  black: '#000000',
  stage0: '#0b0c10',   // faint top glow
  stage1: '#040406',   // deep floor
  ink: '#f4f6fb',
  dim: '#8c93a6',
  faint: '#4b5262',
  tesla: '#e82127',    // THE accent, used sparingly
  teslaDim: '#7a1013',
  jet: '#bfe3ff',      // cold-gas blue (functional, not decorative)
  jetHot: '#ffffff',
  gold: '#e9c46a',
  line: '#20242e',
  hair: '#2b2f3a',
};

export const FONT = '"Inter","Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

/* overhead key-light cone + reflective floor + vignette + film grain */
export const Bg: React.FC<{children?: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  return (
    <div style={{position:'absolute', inset:0, background:C.black, overflow:'hidden', fontFamily:FONT}}>
      {/* overhead key light */}
      <div style={{position:'absolute', inset:0,
        background:`radial-gradient(1100px 620px at 50% 30%, ${C.stage0} 0%, rgba(8,9,13,0.55) 42%, ${C.black} 78%)`}}/>
      {/* reflective floor sheen */}
      <div style={{position:'absolute', left:0, right:0, bottom:0, height:'38%',
        background:`linear-gradient(to bottom, rgba(40,44,56,0) 0%, rgba(22,25,33,0.5) 60%, rgba(10,11,15,0.9) 100%)`}}/>
      {/* floor horizon hairline */}
      <div style={{position:'absolute', left:0, right:0, bottom:'38%', height:1, background:`linear-gradient(90deg, transparent, ${C.hair} 20%, ${C.hair} 80%, transparent)`, opacity:0.6}}/>
      {children}
      {/* vignette */}
      <div style={{position:'absolute', inset:0, pointerEvents:'none',
        boxShadow:'inset 0 0 420px 120px rgba(0,0,0,0.85)'}}/>
      {/* film grain (animated, subtle) */}
      <Grain seed={f}/>
    </div>
  );
};

const Grain: React.FC<{seed:number}> = ({seed}) => {
  // a sparse set of faint noise dots that reseed each frame
  const dots = Array.from({length:120}).map((_,i)=>{
    const x = random(`gx${seed}${i}`)*1920;
    const y = random(`gy${seed}${i}`)*1080;
    const o = 0.02 + random(`go${seed}${i}`)*0.05;
    return <circle key={i} cx={x} cy={y} r={0.9} fill="#ffffff" opacity={o}/>;
  });
  return <svg width="1920" height="1080" style={{position:'absolute',inset:0, mixBlendMode:'screen', opacity:0.5}}>{dots}</svg>;
};

/* keynote lower-third: thin wide-tracked kicker + heavy headline + light sub */
export const Caption: React.FC<{title:string; sub?:string; tag?:string}> = ({title, sub, tag}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0,18], [0,1], {extrapolateRight:'clamp'});
  const y = interpolate(f, [0,18], [26,0], {extrapolateRight:'clamp'});
  return (
    <div style={{position:'absolute', left:110, right:110, bottom:96, transform:`translateY(${y}px)`, opacity:o}}>
      {tag && (
        <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:14}}>
          <div style={{width:34, height:2, background:C.tesla}}/>
          <div style={{color:C.tesla, fontWeight:600, letterSpacing:7, fontSize:19, textTransform:'uppercase'}}>{tag}</div>
        </div>
      )}
      <div style={{color:C.ink, fontSize:56, fontWeight:800, lineHeight:1.12, letterSpacing:-0.5, textShadow:'0 6px 40px rgba(0,0,0,.7)'}}>{title}</div>
      {sub && <div style={{color:C.dim, fontSize:26, marginTop:16, lineHeight:1.6, maxWidth:1300, fontWeight:300}}>{sub}</div>}
    </div>
  );
};

/* a cold-gas thruster jet: glowing cone from (x,y) toward angle(deg), length scales with power */
export const Jet: React.FC<{x:number;y:number;angle:number;power:number;scale?:number}> = ({x,y,angle,power,scale=1}) => {
  const f = useCurrentFrame();
  const flick = 0.85 + 0.15*Math.sin(f*0.9 + x*0.1);
  const len = 150*power*flick*scale, w = 30*scale;
  const gid = `jg${Math.round(x)}_${Math.round(y)}_${Math.round(angle)}`;
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`} opacity={power<=0.02?0:1}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.jetHot} stopOpacity="0.95"/>
          <stop offset="0.35" stopColor={C.jet} stopOpacity="0.85"/>
          <stop offset="1" stopColor={C.jet} stopOpacity="0"/>
        </linearGradient>
        <filter id={gid+'b'}><feGaussianBlur stdDeviation={2.4}/></filter>
      </defs>
      <path d={`M0,${-w/2} L${len},${-w*0.14} L${len},${w*0.14} L0,${w/2} Z`} fill={`url(#${gid})`} filter={`url(#${gid}b)`}/>
      {Array.from({length:7}).map((_,i)=>{const p=(i/7);return (
        <circle key={i} cx={len*(0.28+p*0.72)} cy={(Math.sin(f*0.5+i)*w*0.32)} r={3.2*scale*(1-p)+1} fill={C.jet} opacity={(1-p)*0.85*power}/>);})}
    </g>
  );
};

/* -------------------------------------------------------------- *
 * Roadster 2 side profile — low fastback coupe, short front      *
 * overhang, long sloping roofline, deployable rear wing, aero     *
 * turbine wheels. Drawn in a 1080-wide local box, wheels at y~250.*
 * Rendered as a dark carbon body with a single red lightblade.    *
 * -------------------------------------------------------------- */
export const Roadster2: React.FC<{scale?:number; wing?:number; headlight?:number}> = ({scale=1, wing=0, headlight=1}) => {
  return (
  <g transform={`scale(${scale})`}>
    <defs>
      <linearGradient id="r2body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b2f38"/>
        <stop offset="0.35" stopColor="#15181f"/>
        <stop offset="1" stopColor="#070809"/>
      </linearGradient>
      <linearGradient id="r2top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a3f4a"/>
        <stop offset="1" stopColor="#1a1d24"/>
      </linearGradient>
      <linearGradient id="r2glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8fb6d6" stopOpacity="0.55"/>
        <stop offset="1" stopColor="#2a3a4a" stopOpacity="0.3"/>
      </linearGradient>
      <radialGradient id="r2wheel" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#2a2e36"/>
        <stop offset="0.7" stopColor="#0d0f13"/>
        <stop offset="1" stopColor="#000"/>
      </radialGradient>
      <linearGradient id="r2under" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.tesla} stopOpacity="0"/>
        <stop offset="0.5" stopColor={C.tesla} stopOpacity="0.9"/>
        <stop offset="1" stopColor={C.tesla} stopOpacity="0"/>
      </linearGradient>
    </defs>

    {/* soft contact shadow */}
    <ellipse cx={540} cy={300} rx={470} ry={26} fill="#000" opacity={0.55}/>

    {/* deployable rear wing */}
    <g opacity={wing}>
      <rect x={905} y={120 - 42*wing} width={150} height={10} rx={5} fill="#101217" stroke="#2a2e36" strokeWidth={1.5}/>
      <rect x={1000} y={120 - 42*wing} width={8} height={44*wing} fill="#101217"/>
      <rect x={930} y={120 - 42*wing} width={8} height={44*wing} fill="#101217"/>
    </g>

    {/* main body — low fastback silhouette */}
    <path d="M70,250
             C70,214 120,196 190,190
             C250,150 330,120 470,112
             C640,102 760,118 850,150
             C960,165 1030,196 1055,224
             C1066,236 1066,250 1050,258
             L95,258 C80,258 70,256 70,250 Z"
          fill="url(#r2body)" stroke="#3a4150" strokeWidth="2"/>

    {/* greenhouse / removable glass roof */}
    <path d="M300,128 C410,104 620,104 740,128 C720,150 640,140 520,140 C430,140 350,146 300,128 Z"
          fill="url(#r2glass)"/>
    {/* roof top sheen line */}
    <path d="M320,120 C430,100 620,100 720,120" fill="none" stroke="#9fb6cc" strokeWidth="2" opacity="0.4"/>

    {/* beltline / character crease */}
    <path d="M150,196 C360,168 720,170 1040,224" fill="none" stroke="#454c5b" strokeWidth="2" opacity="0.7"/>

    {/* front splitter + headlight sliver */}
    <path d="M70,250 C70,236 86,228 112,226 L150,232 L120,252 L95,256 C80,256 70,255 70,250 Z" fill="#0a0c10"/>
    <path d="M96,224 L150,222 L150,230 L100,232 Z" fill={C.tesla} opacity={0.15 + 0.85*headlight}/>

    {/* red under-glow light blade (the single accent) */}
    <rect x={120} y={262} width={900} height={4} rx={2} fill="url(#r2under)"/>

    {/* wheels — aero turbine, dark */}
    {[265, 835].map((cx,i)=>(
      <g key={i}>
        <circle cx={cx} cy={252} r={64} fill="url(#r2wheel)" stroke="#2b3240" strokeWidth={4}/>
        <circle cx={cx} cy={252} r={64} fill="none" stroke="#000" strokeWidth={10} opacity={0.5}/>
        {/* turbine spokes */}
        {Array.from({length:9}).map((_,k)=>{
          const a=(k/9)*Math.PI*2; const r1=22, r2=52;
          return <line key={k} x1={cx+Math.cos(a)*r1} y1={252+Math.sin(a)*r1} x2={cx+Math.cos(a)*r2} y2={252+Math.sin(a)*r2} stroke="#1c2029" strokeWidth={6} strokeLinecap="round"/>;
        })}
        <circle cx={cx} cy={252} r={16} fill="#0d0f13" stroke="#333a47" strokeWidth={2}/>
        {/* rim highlight */}
        <path d={`M${cx-46},${252-44} A64 64 0 0 1 ${cx+40},${252-50}`} fill="none" stroke="#6b7486" strokeWidth={2} opacity={0.5}/>
      </g>
    ))}

    {/* wheel-arch shadow */}
    <path d="M205,252 a60 60 0 0 1 120 0" fill="none" stroke="#000" strokeWidth={6} opacity={0.4}/>
    <path d="M775,252 a60 60 0 0 1 120 0" fill="none" stroke="#000" strokeWidth={6} opacity={0.4}/>
  </g>
  );
};

export const useAppear = (delay=0, dur=18) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return spring({frame: f-delay, fps, config:{damping:200}, durationInFrames:dur});
};
