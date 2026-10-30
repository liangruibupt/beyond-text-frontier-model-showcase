import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing, spring, useVideoConfig } from 'remotion';
import { Bg, Caption, Jet, Roadster2, C, FONT } from './lib';

export const ROADSTER_FPS = 30;

// narration-driven per-scene frame counts (written by narrate.py); fallback to defaults.
import durJson from '../durations.json';
const DEFAULT_SEC = [7,12,12,11,13,10,11,13,8];
const SCENE_IDS = ['title','reveal','truth','layout','newton','hover','vector','limits','end'];
const SCENE_FRAMES: number[] = (Array.isArray(durJson) && durJson.length===SCENE_IDS.length)
  ? durJson as number[]
  : DEFAULT_SEC.map(s=>Math.round(s*ROADSTER_FPS));
const SCENES = SCENE_IDS.map((id,i)=>({id, frames: SCENE_FRAMES[i]}));
export const roadsterDurationInFrames = ()=> SCENES.reduce((a,s)=>a+s.frames,0);

/* reusable slow-camera helper: gentle push-in over a scene for keynote feel */
const usePush = (from=1.0, to=1.06, dur=120) => {
  const f = useCurrentFrame();
  return interpolate(f, [0, dur], [from, to], {extrapolateRight:'clamp', easing:Easing.out(Easing.quad)});
};

/* the car staged on the floor, horizontally centered; y is the floor line */
const CarStage: React.FC<{children?:React.ReactNode; y?:number; carScale?:number; wing?:number; headlight?:number; camScale?:number}> =
 ({children, y=470, carScale=0.82, wing=0, headlight=1, camScale=1}) => (
  <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
    <g transform={`translate(960,${y}) scale(${camScale}) translate(${-540*carScale},0)`}>
      <g transform={`scale(${carScale})`}><Roadster2 scale={1} wing={wing} headlight={headlight}/></g>
      {children}
    </g>
  </svg>
);

/* ---------------- individual scenes ---------------- */

const Title: React.FC = () => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const s = spring({frame:f, fps, config:{damping:200}, durationInFrames:36});
  const track = interpolate(f,[0,40],[26,13],{extrapolateRight:'clamp'});
  const sub = interpolate(f,[24,46],[0,1],{extrapolateRight:'clamp'});
  const line = interpolate(f,[10,40],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill style={{justifyContent:'center', alignItems:'center'}}>
      <div style={{textAlign:'center', opacity:s, transform:`translateY(${(1-s)*20}px)`}}>
        <div style={{color:C.tesla, fontWeight:600, letterSpacing:track, fontSize:24}}>T E S L A &nbsp; R O A D S T E R &nbsp; 2</div>
        <div style={{width:interpolate(line,[0,1],[0,340]), height:1, background:`linear-gradient(90deg,transparent,${C.faint},transparent)`, margin:'26px auto'}}/>
        <div style={{color:C.ink, fontWeight:800, fontSize:104, letterSpacing:-1, lineHeight:1.05}}>“飞行汽车”的原理</div>
        <div style={{color:C.dim, fontSize:30, marginTop:26, fontWeight:300, opacity:sub, letterSpacing:1}}>它真的会飞吗？ SpaceX Package 到底做了什么</div>
      </div>
    </AbsoluteFill>
  );
};

const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f,[0,70],[760,0],{easing:Easing.out(Easing.cubic),extrapolateRight:'clamp'});
  const cam = usePush(1.08, 1.0, 70);
  const head = interpolate(f,[40,70],[0,1],{extrapolateRight:'clamp'});
  const shine = interpolate(f%110,[0,55,110],[0,1,0]);
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        <g transform={`translate(${960+x},470) scale(${cam}) translate(${-540*0.86},0)`}>
          <g transform="scale(0.86)"><Roadster2 scale={1} wing={0} headlight={head}/></g>
          <g transform="scale(0.86)"><rect x={200} y={110} width={90} height={150} fill="#ffffff" opacity={shine*0.1} transform="skewX(-22)"/></g>
        </g>
      </svg>
      <Caption tag="Roadster 2 · 第二代" title="最快的量产电动跑车" sub="官方称 0–100 km/h 约 1.9 秒。但真正让它出圈的，是马斯克说的那套能让它“飞”的 SpaceX Package。"/>
    </AbsoluteFill>
  );
};

const Truth: React.FC = () => {
  const f = useCurrentFrame();
  const a = interpolate(f,[6,24],[0,1],{extrapolateRight:'clamp'});
  const cross = interpolate(f,[30,52],[0,1],{extrapolateRight:'clamp'});
  const b = interpolate(f,[40,60],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{justifyContent:'center', alignItems:'center', paddingBottom:120}}>
        <div style={{display:'flex', gap:150, alignItems:'center'}}>
          <div style={{textAlign:'center', opacity:a, transform:`translateY(${(1-a)*20}px)`}}>
            <div style={{fontSize:118, filter:'grayscale(0.4)'}}>✈️</div>
            <div style={{color:C.dim, fontSize:27, marginTop:12, position:'relative', fontWeight:300}}>机翼气动飞行
              <svg width="240" height="46" style={{position:'absolute',left:-20,top:6}}><line x1={10} y1={34} x2={220} y2={8} stroke={C.tesla} strokeWidth={5} opacity={cross} strokeLinecap="round"/></svg>
            </div>
          </div>
          <div style={{color:C.faint, fontSize:52, opacity:b, fontWeight:200}}>→</div>
          <div style={{textAlign:'center', opacity:b, transform:`translateY(${(1-b)*20}px)`}}>
            <div style={{fontSize:118}}>🚀</div>
            <div style={{color:C.jet, fontSize:27, marginTop:12, fontWeight:600}}>冷气推进 · 火箭思路</div>
          </div>
        </div>
      </AbsoluteFill>
      <Caption tag="真相" title="它不是靠机翼“飞”，而是靠火箭思路“推”" sub="SpaceX Package 的核心是一组冷气推进器（cold-gas thrusters）——用高压空气喷射产生推力，而不是空气动力学升力。"/>
    </AbsoluteFill>
  );
};

const Layout: React.FC = () => {
  const f = useCurrentFrame();
  const cam = usePush(1.0, 1.05, 160);
  const appear = (d:number)=>interpolate(f,[d,d+10],[0,1],{extrapolateRight:'clamp'});
  // thruster positions in car-local coords (car is 1080 wide, wheels at y~252)
  const thr = [
    {x:230,y:262,a:90}, {x:400,y:262,a:90}, {x:560,y:262,a:90}, {x:720,y:262,a:90}, {x:880,y:262,a:90}, // underside
    {x:78,y:238,a:178}, {x:1050,y:228,a:2}, // nose / tail
  ];
  return (
    <AbsoluteFill>
      <CarStage y={430} carScale={0.82} camScale={cam}>
        {/* COPV tank callout above rear deck */}
        <g opacity={appear(48)}>
          <line x1={820} y1={170} x2={820} y2={120} stroke={C.gold} strokeWidth={1.5} opacity={0.6}/>
          <rect x={720} y={66} width={200} height={54} rx={27} fill="#10131a" stroke={C.gold} strokeWidth={1.5}/>
          <ellipse cx={766} cy={93} rx={20} ry={16} fill="none" stroke={C.gold} strokeWidth={1.5}/>
          <text x={800} y={99} fill={C.gold} fontSize={19} fontWeight={600} fontFamily={FONT}>COPV 高压罐</text>
        </g>
        {thr.map((p,i)=>(
          <g key={i} opacity={appear(8+i*5)}>
            <circle cx={p.x} cy={p.y} r={6} fill={C.jet}/>
            <circle cx={p.x} cy={p.y} r={11} fill="none" stroke={C.jet} strokeWidth={1} opacity={0.5}/>
            <Jet x={p.x} y={p.y} angle={p.a} power={0.4} scale={0.6}/>
          </g>
        ))}
      </CarStage>
      <Caption tag="布局" title="车身周围约十个喷口 + 后备箱一只高压空气罐" sub="方案把后备箱换成一只碳纤维缠绕高压气瓶（COPV），通过车身四周隐藏的喷口按需放气。"/>
    </AbsoluteFill>
  );
};

const Newton: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f,[14,46],[0,1],{easing:Easing.inOut(Easing.cubic),extrapolateRight:'clamp'});
  const cam = usePush(1.02, 1.08, 180);
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        <g transform={`translate(960,480) scale(${cam}) translate(${-540*0.82},0)`}>
          <g transform="scale(0.82)">
            <Roadster2 scale={1} wing={0.3} headlight={1}/>
            <Jet x={540} y={272} angle={90} power={p} scale={1.5}/>
            <g opacity={p}>
              <line x1={540} y1={150} x2={540} y2={150-140*p} stroke={C.gold} strokeWidth={9} strokeLinecap="round"/>
              <path d={`M540,${150-140*p} l-15,24 l30,0 z`} fill={C.gold}/>
            </g>
          </g>
          <g opacity={p}>
            <text x={90} y={-30} fill={C.gold} fontSize={27} fontWeight={700} fontFamily={FONT}>反作用力 ↑ 车被上推</text>
            <text x={90} y={300} fill={C.jet} fontSize={25} fontWeight={600} fontFamily={FONT}>高压气体喷出 ↓</text>
          </g>
        </g>
      </svg>
      <Caption tag="原理 · 牛顿第三定律" title="气体往下喷，车就被往上推" sub="高压空气以极高速度向下喷出，根据作用力与反作用力，车身获得一个向上的反推力——和火箭、冷气姿控完全同一个道理。"/>
    </AbsoluteFill>
  );
};

const Hover: React.FC = () => {
  const f = useCurrentFrame(); const {fps}=useVideoConfig();
  const lift = spring({frame:f-18, fps, config:{damping:13, mass:1.3}, durationInFrames:70});
  const dy = -150*lift + Math.sin(f*0.14)*7*lift;
  const cam = usePush(1.0, 1.04, 150);
  const dust = Math.min(1, lift*1.3);
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        {/* floor glow where jets hit */}
        <ellipse cx={960} cy={690} rx={320*dust} ry={26*dust} fill={C.jet} opacity={0.12*dust}/>
        <g transform={`translate(960,${520+dy}) scale(${cam}) translate(${-540*0.82},0)`}>
          <g transform="scale(0.82)">
            <Roadster2 scale={1} wing={0.6} headlight={1}/>
            <Jet x={250} y={272} angle={90} power={0.55+0.45*lift} scale={1.2}/>
            <Jet x={540} y={272} angle={90} power={0.5+0.4*lift} scale={1.1}/>
            <Jet x={830} y={272} angle={90} power={0.55+0.45*lift} scale={1.2}/>
          </g>
        </g>
      </svg>
      <Caption tag="效果" title="短暂离地悬停" sub="多组下喷喷口一起工作，可以把整车短暂抬离地面、稳定悬停——这就是演示里“飞起来”的那几秒。"/>
    </AbsoluteFill>
  );
};

const Vector: React.FC = () => {
  const f = useCurrentFrame();
  const lift = interpolate(f,[0,30],[0,1],{extrapolateRight:'clamp'});
  const lean = interpolate(f%130,[0,65,130],[-5,5,-5],{easing:Easing.inOut(Easing.sin)});
  const dy = -90*lift;
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
        <g transform={`translate(960,${520+dy}) rotate(${lean}) translate(${-540*0.82},0)`}>
          <g transform="scale(0.82)">
            <Roadster2 scale={1} wing={0.8} headlight={1}/>
            <Jet x={70} y={210} angle={205} power={0.75} scale={1.0}/>
            <Jet x={1055} y={210} angle={-25} power={0.45} scale={0.8}/>
            <Jet x={300} y={272} angle={90} power={0.5} scale={0.9}/>
            <Jet x={780} y={272} angle={90} power={0.5} scale={0.9}/>
          </g>
        </g>
      </svg>
      <Caption tag="进阶" title="喷口可定向：帮助加速、过弯、起步" sub="按需调整各喷口的方向与开度，能在直线上再加一把推力、过弯时多一份侧向力——这是“推进辅助操控”，不只是悬浮。"/>
    </AbsoluteFill>
  );
};

const Limits: React.FC = () => {
  const f = useCurrentFrame();
  const items = ['不是真正的航空飞行，只是短时冷气推进','高压气瓶容量有限，喷射时间很短','噪音、安全、法规都是现实门槛','截至目前仍是概念 / 演示，未量产交付'];
  const appear=(i:number)=>interpolate(f,[12+i*14,26+i*14],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{justifyContent:'center', paddingLeft:150, paddingBottom:120}}>
        {items.map((t,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:24,opacity:appear(i),transform:`translateX(${(1-appear(i))*40}px)`, margin:'16px 0'}}>
            <div style={{width:9,height:9,borderRadius:5,background:C.tesla, boxShadow:`0 0 14px ${C.tesla}`}}/>
            <div style={{color:C.ink, fontSize:38, fontWeight:400, letterSpacing:0.3}}>{t}</div>
          </div>
        ))}
      </AbsoluteFill>
      <Caption tag="现实边界" title="酷，但别把它当飞机" sub="SpaceX Package 让 Roadster 2 能短暂离地、推进辅助，但它仍是一台地面跑车的极限玩法，而非会飞的汽车。"/>
    </AbsoluteFill>
  );
};

const End: React.FC = () => {
  const f = useCurrentFrame(); const {fps}=useVideoConfig();
  const s = spring({frame:f, fps, config:{damping:200}, durationInFrames:40});
  const track = interpolate(f,[0,50],[6,18],{extrapolateRight:'clamp'});
  const line = interpolate(f,[16,46],[0,1],{extrapolateRight:'clamp'});
  return (
    <AbsoluteFill style={{justifyContent:'center', alignItems:'center'}}>
      <div style={{textAlign:'center', opacity:s}}>
        <div style={{color:C.ink, fontWeight:800, letterSpacing:track, fontSize:84}}>T E S L A</div>
        <div style={{width:interpolate(line,[0,1],[0,420]), height:1, background:`linear-gradient(90deg,transparent,${C.tesla},transparent)`, margin:'28px auto'}}/>
        <div style={{color:C.dim, fontSize:34, fontWeight:300, letterSpacing:3}}>ROADSTER 2 · SpaceX Package</div>
        <div style={{color:C.faint, fontSize:22, marginTop:34, fontWeight:300, letterSpacing:1}}>冷气推进原理讲解 · 本片由代码生成</div>
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
