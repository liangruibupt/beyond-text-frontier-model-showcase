# 14 · 特斯拉 Roadster 2 · “飞行汽车”原理讲解 (Remotion)

用 **Remotion（React 做视频）** 做的科技讲解短片：拆解特斯拉 Roadster 2 “SpaceX Package” 让车短暂离地的冷气推进原理。1920×1080，约 1 分 37 秒，9 幕，中文旁白（AWS Polly）+ 极客风背景音乐，**特斯拉发布会式的视觉风格**。

> 成品：[`assets/roadster2.mp4`](assets/roadster2.mp4) — 1:37，H.264 + AAC。

## 这是什么

和沙画案例（13）的 Canvas 逐帧不同，这支片用 **Remotion** 把每一幕写成 React 组件（SVG 矢量跑车、冷气喷流、牛顿第三定律受力箭头、数据排版），用 spring/interpolate 做动效，再由 Remotion 的无头 Chromium 逐帧渲染成 1080p。

## 视觉风格（发布会质感）

参照真实 Roadster 2 的设计（低趴快背轮廓、可拆玻璃车顶、可展开尾翼、气动涡轮轮毂），整片走 **Tesla 产品发布会** 的美学：

- **纯黑舞台** + 顶光锥 + 反光地面 + 暗角 + 轻微胶片颗粒。
- **细字宽字距排版**（Inter + Noto Sans SC），下三分之一字幕只保留细红线 kicker + 重标题 + 细说明。
- **单一红色高光**：只用在车底红色光刃、要点圆点、片尾分隔线上，克制使用。
- **缓慢推镜**（push-in）与景深层次，取代原来平铺的信息图网格。

## 9 幕

标题 → Roadster 2 亮相（侧滑入场 + 车头点亮）→ **真相：不是机翼飞行，是火箭思路（冷气推进）** → 布局（后备箱 COPV 高压空气罐 + 车身约十个喷口）→ **牛顿第三定律：气体下喷 → 车被上推** → 短暂离地悬停（尾翼展开 + 地面蓝光）→ 喷口定向辅助加速/过弯 → 现实边界 → TESLA 片尾卡。

## 技术要点

- **Remotion + React + SVG**：`src/Roadster.tsx` 是分幕编排与运镜，`src/lib.tsx` 是主题 + 可复用组件（黑色舞台背景 `Bg`、胶片颗粒、下三分之一字幕 `Caption`、准确的 Roadster 2 侧视图 `Roadster2`（带尾翼/车头灯参数）、`Jet` 冷气喷流）。
- **节奏跟配音（narration-driven）**：`narrate.py` 先合成每幕旁白、测真实时长，写出 `durations.json`；`Roadster.tsx` 读它决定每幕帧数——配音多长，这一幕就播多久，音画锁定。
- **中文旁白：AWS Polly**（`Zhiyu`，neural 引擎，`cmn-CN`）。相比此前的本地 TTS，Polly 对句中夹杂的英文术语（SpaceX Package、COPV、cold-gas thrusters、km/h）读得更清楚，中英混排不含糊。
- **背景音乐（真实可听）**：`narrate.py` 用 ffmpeg 原创合成一段无版权极客风垫乐（A 小调分层正弦 + tremolo 门控脉冲 + 高频“数据”点缀，低通 + 轻压缩），再用 **sidechain 压缩** 把垫乐压到旁白之下：说话时音乐退到约 −22dB，旁白间隙音乐上前到约 −26dB。混音后用 `volumedetect` 在无人声段实测，确认音乐确实存在且可听（不是此前那种被旁白盖死、几乎静音的状态）。

## 内容准确性

“SpaceX Package / 冷气推进器 / COPV 高压罐 / 约十个喷口”是基于马斯克与特斯拉的**公开说法**，属于**概念，至今未量产交付**；片中第 8 幕明确讲了这条边界。本片是原理科普，不是宣称 Roadster 2 已能当飞机。

## 文件

| 文件 | 作用 |
|---|---|
| `src/index.ts` / `src/Root.tsx` | Remotion 入口 + Composition 注册（1920×1080，30fps） |
| `src/Roadster.tsx` | 9 幕编排 + 运镜，时长读自 `durations.json` |
| `src/lib.tsx` | 发布会主题 + 可复用视觉组件（Roadster 2 侧视图等） |
| `narrate.py` | Polly 合成旁白 → `durations.json`、对齐音轨、原创 BGM、最终 sidechain 混音 |
| `durations.json` | 每幕帧数（由配音时长算出） |
| `assets/roadster2.mp4` | **成品视频** |

## 重建

```bash
npm install                      # remotion + react
# 旁白 + 背景乐 + 混音（需 AWS 凭证可调用 Polly，和 KIROCREW_SCRATCH 里的静态 ffmpeg）
python3 -m venv .venv && ./.venv/bin/pip install boto3
./.venv/bin/python narrate.py    # 写 durations.json + narration.wav + bgm.wav + narration_bgm.wav
npx remotion render src/index.ts Roadster out/roadster2-silent.mp4
# 封装：把无声视频与 narration_bgm.wav 合成
ffmpeg -y -i out/roadster2-silent.mp4 -i narration_bgm.wav \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest assets/roadster2.mp4
```

## 说明

“Opus 5.5 + Remotion” 指模型负责分镜、文案、组件编排，视频像素由 Remotion/React 渲染产出——不是文生视频模型直出。旁白声音由 AWS Polly 合成。
