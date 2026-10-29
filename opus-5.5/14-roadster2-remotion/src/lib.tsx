import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export const C = {
  bg0: '#05070f', bg1: '#0a1022', ink: '#eaf0ff', dim: '#9fb0d8',
  tesla: '#e82127', jet: '#8fd0ff', jetHot: '#ffffff', gold: '#ffd166', grid: '#15203f',
};

export const Bg: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <div style={{position:'absolute', inset:0, background:`radial-gradient(1200px 700px at 50% 35%, ${C.bg1} 0%, ${C.bg0} 70%)`, overflow:'hidden',
    fontFamily:'"PingFang SC","Hiragino Sans GB","Microsoft YaHei",Inter,system-ui,sans-serif'}}>
    {/* faint grid */}
    <svg style={{position:'absolute',inset:0,opacity:0.25}} width="1920" height="1080">
      {Array.from({length:40}).map((_,i)=><line key={'v'+i} x1={i*48} y1={0} x2={i*48} y2={1080} stroke={C.grid} strokeWidth={1}/>)}
      {Array.from({length:23}).map((_,i)=><line key={'h'+i} x1={0} y1={i*48} x2={1920} y2={i*48} stroke={C.grid} strokeWidth={1}/>)}
    </svg>
    {children}
  </div>
);

/* lower-third caption: Chinese title + subtitle */
export const Caption: React.FC<{title:string; sub?:string; tag?:string}> = ({title, sub, tag}) => {
  const f = useCurrentFrame();
  const y = interpolate(f, [0,16], [40,0], {extrapolateRight:'clamp'});
  const o = interpolate(f, [0,16], [0,1], {extrapolateRight:'clamp'});
  return (
    <div style={{position:'absolute', left:90, right:90, bottom:70, transform:`translateY(${y}px)`, opacity:o}}>
      {tag && <div style={{color:C.tesla, fontWeight:800, letterSpacing:4, fontSize:26, marginBottom:8}}>{tag}</div>}
      <div style={{color:C.ink, fontSize:58, fontWeight:800, lineHeight:1.15, textShadow:'0 4px 30px rgba(0,0,0,.6)'}}>{title}</div>
      {sub && <div style={{color:C.dim, fontSize:30, marginTop:12, lineHeight:1.5, maxWidth:1400}}>{sub}</div>}
    </div>
  );
};

/* a cold-gas thruster jet: a glowing cone of gas shooting from (x,y) toward angle(deg), length scales with power 0..1 */
export const Jet: React.FC<{x:number;y:number;angle:number;power:number;scale?:number}> = ({x,y,angle,power,scale=1}) => {
  const f = useCurrentFrame();
  const flick = 0.85 + 0.15*Math.sin(f*0.9 + x*0.1);
  const len = 120*power*flick*scale, w = 26*scale;
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`} opacity={power<=0.02?0:1}>
      <defs>
        <linearGradient id={`jg${Math.round(x)}${Math.round(y)}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.jetHot} stopOpacity="0.95"/>
          <stop offset="0.4" stopColor={C.jet} stopOpacity="0.8"/>
          <stop offset="1" stopColor={C.jet} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`M0,${-w/2} L${len},${-w*0.15} L${len},${w*0.15} L0,${w/2} Z`} fill={`url(#jg${Math.round(x)}${Math.round(y)})`}/>
      {Array.from({length:6}).map((_,i)=>{const p=(i/6);return <circle key={i} cx={len*(0.3+p*0.7)} cy={(Math.sin(f*0.5+i)*w*0.3)} r={3*scale*(1-p)+1} fill={C.jet} opacity={(1-p)*0.8*power}/>;})}
    </g>
  );
};

/* Roadster 2 low sleek side profile (stylized) */
export const Roadster2: React.FC<{scale?:number}> = ({scale=1}) => (
  <g transform={`scale(${scale})`}>
    <defs>
      <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e82127"/>
        <stop offset="0.55" stopColor="#b3161b"/>
        <stop offset="1" stopColor="#6e0d10"/>
      </linearGradient>
    </defs>
    {/* body */}
    <path d="M60,150 C120,96 300,70 520,70 C720,70 860,86 980,120 C1030,134 1060,150 1060,170 L1060,196 L60,196 Z"
      fill="url(#carBody)" stroke="#ffd1d3" strokeWidth="3"/>
    {/* glass canopy */}
    <path d="M300,96 C420,74 640,74 760,96 C740,120 640,108 520,108 C420,108 340,116 300,96 Z" fill="#9fd0ff" opacity="0.6"/>
    {/* lower accent */}
    <path d="M70,196 L1050,196 L1030,210 L95,210 Z" fill="#0a0f1e"/>
    {/* wheels */}
    <circle cx="250" cy="200" r="60" fill="#0a0f1e" stroke="#2b3b63" strokeWidth="6"/>
    <circle cx="250" cy="200" r="26" fill="#1a2544"/>
    <circle cx="860" cy="200" r="60" fill="#0a0f1e" stroke="#2b3b63" strokeWidth="6"/>
    <circle cx="860" cy="200" r="26" fill="#1a2544"/>
  </g>
);

export const useAppear = (delay=0, dur=18) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return spring({frame: f-delay, fps, config:{damping:200}, durationInFrames:dur});
};
