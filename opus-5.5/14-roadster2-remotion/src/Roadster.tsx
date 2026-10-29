import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing, spring, useVideoConfig } from 'remotion';
import { Bg, Caption, Jet, Roadster2, C } from './lib';

export const ROADSTER_FPS = 30;

// narration-driven per-scene frame counts (written by narrate.py); fallback to defaults.
import durJson from '../durations.json';
const DEFAULT_SEC = [5,7,8,9,9,8,8,8,6];
const SCENE_IDS = ['title','reveal','truth','layout','newton','hover','vector','limits','end'];
const SCENE_FRAMES: number[] = (Array.isArray(durJson) && durJson.length===SCENE_IDS.length)
  ? durJson as number[]
  : DEFAULT_SEC.map(s=>Math.round(s*ROADSTER_FPS));
const SCENES = SCENE_IDS.map((id,i)=>({id, frames: SCENE_FRAMES[i]}));
const F = (frames:number)=>frames;
export const roadsterDurationInFrames = ()=> SCENES.reduce((a,s)=>a+s.frames,0);

/* ---------------- individual scenes ---------------- */

const Title: React.FC = () => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const s = spring({frame:f, fps, config:{damping:200}, durationInFrames:30});
  const sub = interpolate(f,[18,34],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill style={{justifyContent:'center', alignItems:'center'}}>
      <div style={{transform:`scale(${0.8+s*0.2})`, opacity:s, textAlign:'center'}}>
        <div style={{color:C.tesla, fontWeight:900, letterSpacing:10, fontSize:34}}>TESLA ROADSTER 2</div>
        <div style={{color:C.ink, fontWeight:900, fontSize:92, marginTop:10}}>“飞行汽车”的原理</div>
        <div style={{color:C.dim, fontSize:34, marginTop:18, opacity:sub}}>它真的会飞吗？ SpaceX Package 到底做了什么</div>
      </div>
    </AbsoluteFill>
  );
};

const CarStage: React.FC<{children?:React.ReactNode; y?:number; carScale?:number}> = ({children, y=360, carScale=0.78}) => (
  <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
    <g transform={`translate(${960-540*carScale},${y})`}>
      <Roadster2 scale={carScale}/>
      {children}
    </g>
  </svg>
);

const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f,[0,50],[-500,0],{easing:Easing.out(Easing.cubic),extrapolateRight:'clamp'});
  const shine = interpolate(f%90,[0,45,90],[0,1,0]);
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        <g transform={`translate(${960-540*0.82+x},360)`}>
          <Roadster2 scale={0.82}/>
          <rect x={120} y={60} width={120} height={160} fill="#ffffff" opacity={shine*0.18} transform="skewX(-20)"/>
        </g>
      </svg>
      <Caption tag="ROADSTER 2 · 2020 发布的第二代" title="最快的量产电动跑车" sub="官方称 0–100 km/h 约 1.9 秒。但真正出圈的，是马斯克说的那套能让它“飞”的 SpaceX Package。"/>
    </AbsoluteFill>
  );
};

const Truth: React.FC = () => {
  const f = useCurrentFrame();
  const cross = interpolate(f,[20,40],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{justifyContent:'flex-start', alignItems:'center', paddingTop:150}}>
        <div style={{display:'flex', gap:120, alignItems:'center'}}>
          <div style={{textAlign:'center', opacity:1}}>
            <div style={{fontSize:120}}>✈️</div>
            <div style={{color:C.dim, fontSize:30, marginTop:10, position:'relative'}}>机翼气动飞行
              <svg width="220" height="40" style={{position:'absolute',left:-10,top:10}}><line x1={10} y1={30} x2={200} y2={5} stroke={C.tesla} strokeWidth={6} opacity={cross} strokeLinecap="round"/></svg>
            </div>
          </div>
          <div style={{color:C.dim, fontSize:50}}>→</div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:120}}>🚀</div>
            <div style={{color:C.jet, fontSize:30, marginTop:10, fontWeight:700}}>冷气推进（火箭思路）</div>
          </div>
        </div>
      </AbsoluteFill>
      <Caption tag="真相" title="它不是靠机翼“飞”，而是靠火箭思路“推”" sub="SpaceX Package 的核心是一组冷气推进器（cold-gas thrusters）——用高压空气喷射产生推力，而不是空气动力学升力。"/>
    </AbsoluteFill>
  );
};

const Layout: React.FC = () => {
  const f = useCurrentFrame();
  const appear = (d:number)=>interpolate(f,[d,d+10],[0,1],{extrapolateRight:'clamp'});
  // thruster positions around the car (in car-local coords, car drawn at translate below)
  const thr = [
    {x:200,y:205,a:90}, {x:380,y:205,a:90}, {x:560,y:205,a:90}, {x:720,y:205,a:90}, {x:900,y:205,a:90}, // underside down-jets
    {x:70,y:160,a:175}, {x:1055,y:170,a:5}, // nose / tail
  ];
  return (
    <AbsoluteFill>
      <CarStage y={360} carScale={0.78}>
        {thr.map((p,i)=>(
          <g key={i} opacity={appear(8+i*5)}>
            <circle cx={p.x} cy={p.y} r={10} fill={C.jet}/>
            <Jet x={p.x} y={p.y} angle={p.a} power={0.45} scale={0.7}/>
          </g>
        ))}
        {/* COPV tank seated in the rear deck */}
        <g opacity={appear(42)}>
          <ellipse cx={820} cy={120} rx={78} ry={30} fill="#1a2544" stroke={C.gold} strokeWidth={3}/>
          <text x={820} y={127} fill={C.gold} fontSize={20} textAnchor="middle" fontWeight={700}>COPV 高压罐</text>
          <line x1={820} y1={150} x2={820} y2={196} stroke={C.gold} strokeWidth={2} strokeDasharray="5 5"/>
        </g>
      </CarStage>
      <Caption tag="布局" title="车身周围约十个喷口 + 后备箱一只高压空气罐" sub="方案把后备箱换成一只碳纤维缠绕高压气瓶（COPV），通过车身四周隐藏的喷口按需放气。"/>
    </AbsoluteFill>
  );
};

const Newton: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f,[10,40],[0,1],{easing:Easing.inOut(Easing.cubic),extrapolateRight:'clamp'});
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        <g transform="translate(420,380)">
          <Roadster2 scale={0.78}/>
          {/* down jet */}
          <Jet x={500} y={215} angle={90} power={p} scale={1.4}/>
          {/* reaction arrow up */}
          <g opacity={p}>
            <line x1={500} y1={140} x2={500} y2={140-180*p} stroke={C.gold} strokeWidth={10} strokeLinecap="round"/>
            <path d={`M500,${140-180*p} l-16,26 l32,0 z`} fill={C.gold}/>
            <text x={540} y={60} fill={C.gold} fontSize={30} fontWeight={800}>反作用力 ↑</text>
          </g>
          <text x={560} y={300} fill={C.jet} fontSize={30} fontWeight={800}>高压气体喷出 ↓</text>
        </g>
      </svg>
      <Caption tag="原理 · 牛顿第三定律" title="气体往下喷，车就被往上推" sub="高压空气以极高速度向下喷出，根据作用力与反作用力，车身获得一个向上的反推力——和火箭、冷气姿控完全同一个道理。"/>
    </AbsoluteFill>
  );
};

const Hover: React.FC = () => {
  const f = useCurrentFrame(); const {fps}=useVideoConfig();
  const lift = spring({frame:f-15, fps, config:{damping:12, mass:1.2}, durationInFrames:60});
  const dy = -140*lift + Math.sin(f*0.15)*6*lift;
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        {/* ground */}
        <line x1={0} y1={640} x2={1920} y2={640} stroke={C.grid} strokeWidth={3}/>
        <g transform={`translate(${960-540*0.78},${400+dy})`}>
          <Roadster2 scale={0.78}/>
          <Jet x={160} y={215} angle={90} power={0.6+0.4*lift} scale={1.1}/>
          <Jet x={840} y={215} angle={90} power={0.6+0.4*lift} scale={1.1}/>
        </g>
      </svg>
      <Caption tag="效果" title="短暂离地悬停" sub="多组下喷喷口一起工作，可以把整车短暂抬离地面、稳定悬停——这就是演示里“飞起来”的那几秒。"/>
    </AbsoluteFill>
  );
};

const Vector: React.FC = () => {
  const f = useCurrentFrame();
  const lean = interpolate(f%120,[0,60,120],[-6,6,-6],{easing:Easing.inOut(Easing.sin)});
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        <g transform={`translate(${960-540*0.78},400) rotate(${lean},540,160)`}>
          <Roadster2 scale={0.78}/>
          {/* vectored side jets push for cornering/accel */}
          <Jet x={60} y={170} angle={200} power={0.7} scale={1.0}/>
          <Jet x={1060} y={170} angle={-20} power={0.4} scale={0.8}/>
        </g>
      </svg>
      <Caption tag="进阶" title="喷口可定向：帮助加速、过弯、起步" sub="按需调整各喷口的方向与开度，能在直线上再加一把推力、过弯时多一份侧向力——这是“推进辅助操控”，不只是悬浮。"/>
    </AbsoluteFill>
  );
};

const Limits: React.FC = () => {
  const f = useCurrentFrame();
  const items = ['不是真正的航空飞行，只是短时冷气推进','高压气瓶容量有限，喷射时间很短','噪音、安全、法规都是现实门槛','截至目前仍是概念 / 演示，未量产交付'];
  const appear=(i:number)=>interpolate(f,[10+i*12,22+i*12],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{justifyContent:'center', paddingLeft:140}}>
        {items.map((t,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:20,opacity:appear(i),transform:`translateX(${(1-appear(i))*40}px)`, margin:'14px 0'}}>
            <div style={{width:16,height:16,borderRadius:8,background:C.tesla}}/>
            <div style={{color:C.ink, fontSize:40, fontWeight:600}}>{t}</div>
          </div>
        ))}
      </AbsoluteFill>
      <Caption tag="现实边界" title="酷，但别把它当飞机" sub="SpaceX Package 让 Roadster 2 能短暂离地、推进辅助，但它仍是一台地面跑车的极限玩法，而非会飞的汽车。"/>
    </AbsoluteFill>
  );
};

const End: React.FC = () => {
  const f = useCurrentFrame(); const {fps}=useVideoConfig();
  const s = spring({frame:f, fps, config:{damping:200}, durationInFrames:30});
  return (
    <AbsoluteFill style={{justifyContent:'center', alignItems:'center'}}>
      <div style={{textAlign:'center', transform:`scale(${0.9+s*0.1})`, opacity:s}}>
        <div style={{color:C.tesla, fontWeight:900, letterSpacing:16, fontSize:72}}>T E S L A</div>
        <div style={{color:C.ink, fontSize:40, marginTop:16}}>ROADSTER 2 · SpaceX Package</div>
        <div style={{color:C.dim, fontSize:26, marginTop:30}}>冷气推进原理讲解 · 本片由代码生成</div>
      </div>
    </AbsoluteFill>
  );
};

const MAP:Record<string,React.FC> = {title:Title,reveal:Reveal,truth:Truth,layout:Layout,newton:Newton,hover:Hover,vector:Vector,limits:Limits,end:End};

export const Roadster: React.FC = () => {
  let from = 0;
  return (
    <Bg>
      {SCENES.map((sc)=>{
        const Comp = MAP[sc.id]; const dur = sc.frames; const start = from; from += dur;
        return <Sequence key={sc.id} from={start} durationInFrames={dur}><Comp/></Sequence>;
      })}
    </Bg>
  );
};
