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
 * Roadster 2 side profile, generated by tools/trace_roadster.py   *
 * from points traced off ref/roadster2_side.png (real car photo). *
 * Local box ~1080 wide: wheel centres y=220.0, sill y~275.4,        *
 * ground y~305. Pearl-white body, black glass, black   *
 * 5 Y-spoke wheels. `wing` adds a sheen pulse; `headlight` lights  *
 * the headlamp. Edit the point lists in the script, not this code. *
 * -------------------------------------------------------------- */
export const R2 = {frontX:189.3, rearX:896.7, wheelY:220.0, tireR:84.8, sillY:275.4, noseX:42.6, noseY:237.0};

export const Roadster2: React.FC<{scale?:number; wing?:number; headlight?:number}> = ({scale=1, wing=0, headlight=1}) => {
  return (
  <g transform={`scale(${scale})`}>
    <defs>
      <linearGradient id="r2body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbfbfc"/>
        <stop offset="0.35" stopColor="#eceef1"/>
        <stop offset="0.7" stopColor="#c9cdd3"/>
        <stop offset="1" stopColor="#9ba1aa"/>
      </linearGradient>
      <linearGradient id="r2shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5d636c" stopOpacity="0"/>
        <stop offset="1" stopColor="#3c4148" stopOpacity="0.55"/>
      </linearGradient>
      <linearGradient id="r2glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a4250"/>
        <stop offset="0.6" stopColor="#1b2028"/>
        <stop offset="1" stopColor="#11151a"/>
      </linearGradient>
      <radialGradient id="r2rim" cx="0.45" cy="0.4" r="0.6">
        <stop offset="0" stopColor="#24272c"/>
        <stop offset="1" stopColor="#0f1114"/>
      </radialGradient>
      <linearGradient id="r2under" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.tesla} stopOpacity="0"/>
        <stop offset="0.5" stopColor={C.tesla} stopOpacity="0.9"/>
        <stop offset="1" stopColor={C.tesla} stopOpacity="0"/>
      </linearGradient>
      <clipPath id="r2clip"><path d="M46.5,273.5 C35.5,270.1 40.6,261.4 39.3,254.6 C38.0,247.8 38.2,239.8 38.7,232.4 C39.2,225.0 40.0,216.5 42.0,210.2 C44.0,203.9 46.6,200.5 50.4,194.6 C54.2,188.7 59.8,180.9 64.8,175.0 C69.8,169.1 74.8,164.3 80.4,159.4 C86.1,154.5 92.6,150.2 98.7,145.7 C104.8,141.2 110.4,136.3 116.9,132.6 C123.4,128.9 130.0,126.2 137.8,123.5 C145.6,120.8 154.1,118.1 163.9,116.3 C173.7,114.5 185.6,113.2 196.5,112.4 C207.4,111.7 218.2,111.9 229.1,111.8 C240.0,111.7 252.5,112.0 261.7,111.8 C270.9,111.6 276.9,112.1 284.5,110.5 C292.1,108.9 298.1,106.2 307.3,102.0 C316.5,97.8 329.0,90.4 339.9,85.0 C350.8,79.6 360.6,74.6 372.5,69.4 C384.4,64.2 397.5,58.8 411.6,53.7 C425.7,48.6 442.1,43.2 457.3,38.7 C472.5,34.2 487.7,29.5 502.9,26.4 C518.1,23.2 533.4,21.3 548.6,19.8 C563.8,18.3 579.0,17.4 594.2,17.2 C609.4,17.0 623.5,17.5 639.8,18.5 C656.1,19.5 673.5,20.9 692.0,23.1 C710.5,25.3 730.1,28.1 750.7,31.6 C771.4,35.1 794.2,39.6 815.9,44.0 C837.6,48.4 859.4,52.8 881.1,57.7 C902.8,62.6 929.3,68.6 946.3,73.3 C963.2,78.0 972.5,82.8 982.8,85.7 C993.1,88.6 1000.4,89.3 1008.2,90.9 C1016.0,92.5 1025.5,92.8 1029.7,95.5 C1033.9,98.2 1031.4,101.8 1033.6,107.2 C1035.8,112.6 1040.1,120.0 1042.8,128.1 C1045.5,136.2 1048.4,146.1 1049.9,155.5 C1051.4,164.9 1051.9,175.0 1051.9,184.8 C1051.9,194.6 1050.9,204.9 1049.9,214.1 C1048.9,223.3 1047.8,232.0 1046.0,240.2 C1044.2,248.3 1042.3,257.7 1038.9,263.0 C1035.5,268.3 1034.7,270.3 1025.8,272.2 C1016.9,274.1 1009.5,273.6 985.4,274.1 C961.3,274.6 911.5,275.2 881.1,275.4 C850.7,275.6 846.3,276.1 802.8,275.4 C759.3,274.6 683.3,271.3 620.3,270.9 C557.3,270.5 483.4,271.9 424.7,272.8 C366.0,273.7 311.7,275.7 268.2,276.1 C224.7,276.5 191.1,275.6 163.9,275.4 C136.7,275.2 124.8,275.1 105.2,274.8 C85.6,274.5 57.5,276.9 46.5,273.5 Z"/></clipPath>
    </defs>

    <ellipse cx={543} cy={307} rx={479} ry={20} fill="#000" opacity={0.6}/>

    <path d="M46.5,273.5 C35.5,270.1 40.6,261.4 39.3,254.6 C38.0,247.8 38.2,239.8 38.7,232.4 C39.2,225.0 40.0,216.5 42.0,210.2 C44.0,203.9 46.6,200.5 50.4,194.6 C54.2,188.7 59.8,180.9 64.8,175.0 C69.8,169.1 74.8,164.3 80.4,159.4 C86.1,154.5 92.6,150.2 98.7,145.7 C104.8,141.2 110.4,136.3 116.9,132.6 C123.4,128.9 130.0,126.2 137.8,123.5 C145.6,120.8 154.1,118.1 163.9,116.3 C173.7,114.5 185.6,113.2 196.5,112.4 C207.4,111.7 218.2,111.9 229.1,111.8 C240.0,111.7 252.5,112.0 261.7,111.8 C270.9,111.6 276.9,112.1 284.5,110.5 C292.1,108.9 298.1,106.2 307.3,102.0 C316.5,97.8 329.0,90.4 339.9,85.0 C350.8,79.6 360.6,74.6 372.5,69.4 C384.4,64.2 397.5,58.8 411.6,53.7 C425.7,48.6 442.1,43.2 457.3,38.7 C472.5,34.2 487.7,29.5 502.9,26.4 C518.1,23.2 533.4,21.3 548.6,19.8 C563.8,18.3 579.0,17.4 594.2,17.2 C609.4,17.0 623.5,17.5 639.8,18.5 C656.1,19.5 673.5,20.9 692.0,23.1 C710.5,25.3 730.1,28.1 750.7,31.6 C771.4,35.1 794.2,39.6 815.9,44.0 C837.6,48.4 859.4,52.8 881.1,57.7 C902.8,62.6 929.3,68.6 946.3,73.3 C963.2,78.0 972.5,82.8 982.8,85.7 C993.1,88.6 1000.4,89.3 1008.2,90.9 C1016.0,92.5 1025.5,92.8 1029.7,95.5 C1033.9,98.2 1031.4,101.8 1033.6,107.2 C1035.8,112.6 1040.1,120.0 1042.8,128.1 C1045.5,136.2 1048.4,146.1 1049.9,155.5 C1051.4,164.9 1051.9,175.0 1051.9,184.8 C1051.9,194.6 1050.9,204.9 1049.9,214.1 C1048.9,223.3 1047.8,232.0 1046.0,240.2 C1044.2,248.3 1042.3,257.7 1038.9,263.0 C1035.5,268.3 1034.7,270.3 1025.8,272.2 C1016.9,274.1 1009.5,273.6 985.4,274.1 C961.3,274.6 911.5,275.2 881.1,275.4 C850.7,275.6 846.3,276.1 802.8,275.4 C759.3,274.6 683.3,271.3 620.3,270.9 C557.3,270.5 483.4,271.9 424.7,272.8 C366.0,273.7 311.7,275.7 268.2,276.1 C224.7,276.5 191.1,275.6 163.9,275.4 C136.7,275.2 124.8,275.1 105.2,274.8 C85.6,274.5 57.5,276.9 46.5,273.5 Z" fill="url(#r2body)"/>

    <g clipPath="url(#r2clip)">
      <path d="M105.2,274.8 C87.8,266.6 130.2,238.4 163.9,227.2 C197.6,216.0 231.2,211.7 307.3,207.6 C383.4,203.5 537.7,202.4 620.3,202.4 C702.9,202.4 759.3,203.5 802.8,207.6 C846.3,211.7 850.7,216.1 881.1,227.2 C911.5,238.3 998.5,266.1 985.4,274.1 C972.3,282.1 896.2,275.6 802.8,275.4 C709.3,275.2 513.8,272.7 424.7,272.8 C335.6,272.9 321.4,275.8 268.2,276.1 C214.9,276.4 122.6,283.0 105.2,274.8 Z" fill="url(#r2shade)"/>
      <circle cx={189.3} cy={220.0} r={93.9} fill="#0a0b0d"/>
      <circle cx={896.7} cy={220.0} r={93.9} fill="#0a0b0d"/>
      <path d="M1006.3,182.8 L1050.6,194.6 L1048.0,259.8 L1025.8,272.2 L1007.6,270.2 Z" fill="#14161a"/>
    </g>

    <path d="M131.3,142.4 C150.9,140.9 199.7,135.9 248.6,133.3 C297.5,130.7 362.8,128.8 424.7,126.8 C486.6,124.8 560.5,121.9 620.3,121.5 C680.1,121.1 734.4,125.1 783.3,124.2 C832.2,123.3 878.9,118.7 913.7,116.3 C948.5,113.9 978.9,110.9 991.9,109.8" fill="none" stroke="#ffffff" strokeWidth={2.2} opacity={0.55}/>
    <path d="M315.1,109.8 C316.4,105.2 336.6,92.0 346.4,85.7 C356.2,79.4 364.9,76.2 373.8,72.0 C382.7,67.8 391.2,63.9 399.9,60.3 C408.6,56.7 413.2,53.6 426.0,50.5 C438.8,47.4 459.6,44.4 476.8,41.4 C494.0,38.4 511.6,34.4 529.0,32.2 C546.4,30.0 566.0,29.0 581.2,28.3 C596.4,27.6 607.3,27.8 620.3,28.3 C633.3,28.9 644.2,30.0 659.4,31.6 C674.6,33.2 694.2,35.5 711.6,38.1 C729.0,40.7 747.6,43.9 763.7,47.2 C779.8,50.5 804.8,53.6 808.1,57.7 C811.4,61.8 795.0,68.5 783.3,72.0 C771.5,75.5 753.9,76.5 737.6,78.5 C721.3,80.5 698.5,82.2 685.5,83.7 C672.5,85.2 668.1,86.4 659.4,87.6 C650.7,88.8 646.3,89.6 633.3,90.9 C620.3,92.2 598.6,93.9 581.2,95.5 C563.8,97.1 546.4,99.1 529.0,100.7 C511.6,102.3 494.2,103.8 476.8,105.2 C459.4,106.6 442.1,108.0 424.7,109.2 C407.3,110.4 386.9,111.8 372.5,112.4 C358.1,113.1 348.2,113.5 338.6,113.1 C329.0,112.7 313.8,114.4 315.1,109.8 Z" fill="url(#r2glass)"/>
    <path d="M339.9,82.4 C356.2,76.8 404.0,57.2 437.7,48.5 C471.4,39.8 513.8,33.8 542.0,30.3 C570.2,26.8 596.3,28.1 607.2,27.7" fill="none" stroke="#8d99a8" strokeWidth={1.6} opacity={0.45}/>
    <path d="M390.8,75.9 L392.7,111.1" stroke="#0b0d10" strokeWidth={2.5}/>
    <path d="M643.8,29.0 L630.7,91.6" stroke="#0b0d10" strokeWidth={3}/>
    <path d="M320.4,121.5 C320.1,135.8 318.4,184.1 318.4,207.6 C318.4,231.1 302.7,253.9 320.4,262.4 C338.1,270.9 389.9,260.2 424.7,258.5 C459.5,256.8 502.4,254.7 529.0,251.9 C555.6,249.1 571.4,248.9 584.4,241.5 C597.4,234.1 600.7,221.9 607.2,207.6 C613.7,193.3 619.4,170.7 623.5,155.5 C627.6,140.3 629.7,126.7 632.0,116.3 C634.3,105.9 636.3,96.8 637.2,92.9" fill="none" stroke="#5b6069" strokeWidth={1.3} opacity={0.8}/>
    <path d="M253.9,138.5 L315.1,142.4 L311.2,156.8 L282.5,159.4 Z" fill="#15181c"/>
    <path d="M982.1,88.3 L1029.7,95.5 L1031.0,103.3 L986.7,99.4 Z" fill="#1a1c20"/>
    <path d="M57.0,186.7 L72.6,168.5 L93.5,155.5 L98.7,162.0 L79.1,175.0 L63.5,192.0 Z" fill="#14171b"/>
    <path d="M62.2,185.4 L94.8,158.1" stroke="#eef6ff" strokeWidth={2.2} strokeLinecap="round" opacity={0.15 + 0.85 * headlight}/>
    <rect x={80.4} y={186.7} width={9.1} height={23.5} rx={3} fill="#e8892c" opacity={0.85}/>
    <rect x={996.5} y={192.0} width={8.5} height={26.1} rx={3} fill="#c4222a" opacity={0.85}/>
    <path d="M261.7,272.8 L806.1,271.5 L806.1,279.3 L261.7,280.6 Z" fill="#141619"/>
    <path d="M131.3,142.4 C150.9,140.9 199.7,135.9 248.6,133.3 C297.5,130.7 362.8,128.8 424.7,126.8 C486.6,124.8 560.5,121.9 620.3,121.5 C680.1,121.1 734.4,125.1 783.3,124.2 C832.2,123.3 878.9,118.7 913.7,116.3 C948.5,113.9 978.9,110.9 991.9,109.8" fill="none" stroke="#fff6e6" strokeWidth={4} opacity={0.4 * wing}/>
    <rect x={281.2} y={281.4} width={515} height={3} rx={1.5} fill="url(#r2under)"/>

      <g>
        <circle cx={189.3} cy={220.0} r={84.8} fill="#0c0d0f"/>
        <circle cx={189.3} cy={220.0} r={81.8} fill="none" stroke="#25282d" strokeWidth={2}/>
        <circle cx={189.3} cy={220.0} r={63.9} fill="url(#r2rim)"/>
        <path d="M189.3,206.0 L189.3,186.0 M189.3,186.0 L173.9,162.1 M189.3,186.0 L204.7,162.1 M202.6,215.7 L221.6,209.5 M221.6,209.5 L239.6,187.5 M221.6,209.5 L249.1,216.8 M197.5,231.3 L209.3,247.5 M209.3,247.5 L235.8,257.8 M209.3,247.5 L210.9,275.9 M181.1,231.3 L169.3,247.5 M169.3,247.5 L167.7,275.9 M169.3,247.5 L142.8,257.8 M176.0,215.7 L157.0,209.5 M157.0,209.5 L129.5,216.8 M157.0,209.5 L139.0,187.5" stroke="#2e3238" strokeWidth={7} strokeLinecap="round" fill="none"/>
        <path d="M189.3,206.0 L189.3,186.0 M189.3,186.0 L173.9,162.1 M189.3,186.0 L204.7,162.1 M202.6,215.7 L221.6,209.5 M221.6,209.5 L239.6,187.5 M221.6,209.5 L249.1,216.8 M197.5,231.3 L209.3,247.5 M209.3,247.5 L235.8,257.8 M209.3,247.5 L210.9,275.9 M181.1,231.3 L169.3,247.5 M169.3,247.5 L167.7,275.9 M169.3,247.5 L142.8,257.8 M176.0,215.7 L157.0,209.5 M157.0,209.5 L129.5,216.8 M157.0,209.5 L139.0,187.5" stroke="#4a4f57" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.6}/>
        <circle cx={189.3} cy={220.0} r={63.9} fill="none" stroke="#16181b" strokeWidth={3}/>
        <circle cx={189.3} cy={220.0} r={11} fill="#202328" stroke="#3a3f47" strokeWidth={2}/>
        <path d="M144.6,175.3 A63.9 63.9 0 0 1 227.6,168.9" fill="none" stroke="#7a828e" strokeWidth={1.5} opacity={0.45}/>
      </g>
      <g>
        <circle cx={896.7} cy={220.0} r={84.8} fill="#0c0d0f"/>
        <circle cx={896.7} cy={220.0} r={81.8} fill="none" stroke="#25282d" strokeWidth={2}/>
        <circle cx={896.7} cy={220.0} r={63.9} fill="url(#r2rim)"/>
        <path d="M896.7,206.0 L896.7,186.0 M896.7,186.0 L881.3,162.1 M896.7,186.0 L912.1,162.1 M910.0,215.7 L929.0,209.5 M929.0,209.5 L947.0,187.5 M929.0,209.5 L956.5,216.8 M904.9,231.3 L916.7,247.5 M916.7,247.5 L943.2,257.8 M916.7,247.5 L918.3,275.9 M888.5,231.3 L876.7,247.5 M876.7,247.5 L875.1,275.9 M876.7,247.5 L850.2,257.8 M883.4,215.7 L864.4,209.5 M864.4,209.5 L836.9,216.8 M864.4,209.5 L846.4,187.5" stroke="#2e3238" strokeWidth={7} strokeLinecap="round" fill="none"/>
        <path d="M896.7,206.0 L896.7,186.0 M896.7,186.0 L881.3,162.1 M896.7,186.0 L912.1,162.1 M910.0,215.7 L929.0,209.5 M929.0,209.5 L947.0,187.5 M929.0,209.5 L956.5,216.8 M904.9,231.3 L916.7,247.5 M916.7,247.5 L943.2,257.8 M916.7,247.5 L918.3,275.9 M888.5,231.3 L876.7,247.5 M876.7,247.5 L875.1,275.9 M876.7,247.5 L850.2,257.8 M883.4,215.7 L864.4,209.5 M864.4,209.5 L836.9,216.8 M864.4,209.5 L846.4,187.5" stroke="#4a4f57" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.6}/>
        <circle cx={896.7} cy={220.0} r={63.9} fill="none" stroke="#16181b" strokeWidth={3}/>
        <circle cx={896.7} cy={220.0} r={11} fill="#202328" stroke="#3a3f47" strokeWidth={2}/>
        <path d="M852.0,175.3 A63.9 63.9 0 0 1 935.0,168.9" fill="none" stroke="#7a828e" strokeWidth={1.5} opacity={0.45}/>
      </g>
  </g>
  );
};

export const useAppear = (delay=0, dur=18) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return spring({frame: f-delay, fps, config:{damping:200}, durationInFrames:dur});
};
