# 14 · 特斯拉 Roadster 2 · “飞行汽车”原理讲解 (Remotion)

用 **Remotion（React 做视频）** 做的科技讲解短片：拆解特斯拉 Roadster 2 “SpaceX Package” 让车短暂离地的冷气推进原理。1920×1080，约 1 分 33 秒，9 幕，中文旁白 + 极客风背景音乐。

> 成品：[`assets/roadster2.mp4`](assets/roadster2.mp4) — 1:33，H.264 + AAC。

## 这是什么

和沙画案例（13）的 Canvas 逐帧不同，这支片用 **Remotion** 把每一幕写成 React 组件（SVG 矢量跑车、冷气喷流、牛顿第三定律受力箭头、数据排版），用 spring/interpolate 做动效，再由 Remotion 的无头 Chromium 逐帧渲染成 1080p。观感更接近信息图动画。

## 9 幕

标题 → Roadster 2 亮相 → **真相：不是机翼飞行，是火箭思路（冷气推进）** → 布局（后备箱 COPV 高压空气罐 + 车身约十个喷口）→ **牛顿第三定律：气体下喷 → 车被上推** → 短暂离地悬停 → 喷口定向辅助加速/过弯 → 现实边界 → TESLA 片尾卡。

## 技术要点

- **Remotion + React + SVG**：`src/Roadster.tsx` 是分幕编排，`src/lib.tsx` 是可复用组件（背景网格、下三分之一字幕、Roadster 侧视图、`Jet` 冷气喷流、受力箭头）。
- **节奏跟配音（narration-driven）**：`narrate.py` 先用 Kokoro Lambda 合成每幕中文旁白，测时长，写出 `durations.json`；`Roadster.tsx` 读它决定每幕帧数——配音多长，这一幕就播多久，音画锁定。
- **中文旁白**：Kokoro‑82M（`zm_yunjian`），走部署在 AWS 的 **Kokoro Lambda**（arm64，见 13 案例与 `aws-is-how`）。
- **背景音乐**：ffmpeg 原创合成的无版权极客风垫乐（门控合成器琶音 + 稳定脉冲 + 高频点缀，低通），压到 −20dB 垫在旁白下。

## 内容准确性

“SpaceX Package / 冷气推进器 / COPV 高压罐 / 约十个喷口”是基于马斯克与特斯拉的**公开说法**，属于**概念，至今未量产交付**；片中第 8 幕明确讲了这条边界。本片是原理科普，不是宣称 Roadster 2 已能当飞机。

## 文件

| 文件 | 作用 |
|---|---|
| `src/index.ts` / `src/Root.tsx` | Remotion 入口 + Composition 注册（1920×1080，30fps） |
| `src/Roadster.tsx` | 9 幕编排，时长读自 `durations.json` |
| `src/lib.tsx` | 主题 + 可复用视觉组件 |
| `narrate.py` | Kokoro Lambda 合成旁白 → `durations.json` + 对齐音轨 |
| `durations.json` | 每幕帧数（由配音时长算出） |
| `assets/roadster2.mp4` | **成品视频** |

## 重建

```bash
npm install                      # remotion + react
# 旁白（需 AWS 凭证能调 kokoro-tts Lambda，和 KIROCREW_SCRATCH 里的静态 ffmpeg）
python3 -m venv .venv && ./.venv/bin/pip install boto3
./.venv/bin/python narrate.py    # 写 durations.json + narration.wav
npx remotion render src/index.ts Roadster out/roadster2-silent.mp4
# 背景乐 + 混音 + 封装见提交说明；或直接用 assets/roadster2.mp4
```

## 说明

“Opus 5.5 + Remotion” 指模型负责分镜、文案、组件编排，视频像素由 Remotion/React 渲染产出——不是文生视频模型直出。
