# 13 · 纽约地铁百年 · 沙画 (NYC Subway — a Century in Sand)

一支以**沙画**风格讲述纽约地铁百年发展史的解说短片，中文旁白 + 纯中文字幕，12 个历史分镜，1280×720，约 3 分钟。

![封面](assets/nyc-subway-sandart.mp4)

> 成品视频：[`assets/nyc-subway-sandart.mp4`](assets/nyc-subway-sandart.mp4) — 2′59″，H.264 + AAC。

## 这是什么

全程由代码生成（无文生视频模型）：一个基于 Canvas 的"沙画引擎"把每一幕用金色沙粒逐笔绘制在暖色纸底上，按旁白节奏播放，再由无头 Chromium 逐帧截图、ffmpeg 编码为视频，最后混入 Kokoro TTS 中文旁白与一段原创氛围垫乐。

## 12 幕叙事

1869 高架时代 · 1870 比奇气动试验 · 1904 IRT 开通 · 1913–1931 双合同扩张（布鲁克林桥剪影）· 1918 马尔本街惨剧 · 1932 IND 市营自建线 · 1940 三线统一（帝国大厦剪影）· 1948 投币与代币 · 1970s 至暗低谷 · 1989 洁净车计划 · 2017 第二大道线 · 今天 472 座车站。

## 视觉 / 音频特效

- **沙画笔触**：带压感的沙粒笔画，起笔收笔渐细；绘制用 ease-in-out 缓动。
- **流沙过渡**：换幕时采样当前沙层为粒子，用风吹 + 重力 + 加速让沙粒飞散瓦解，再堆成下一幕（非简单淡出）。
- **精细图形**：带车门/转向架/车灯/受电弓的地铁车厢、蒸汽机车、高架轨道支柱、亮窗天际线；布鲁克林桥与帝国大厦剪影；收尾网络图用真实 MTA 线路配色圆点（红/蓝/黄/绿/橙/紫）。
- **节奏跟配音**：每一幕的**绘制时长 = 该幕配音时长**，沙粒一点点落下、逐步成形，不再瞬间画完。
- **中文旁白**：Kokoro‑82M（`zm_yunjian` 男声），方法取自 `aws-is-how/ai-ml/aigc/audio_models/Kokoro`。本片用**部署在 AWS 上的 Kokoro Lambda**（arm64 Graviton，`kokoro-tts`）批量合成，逐幕 `lambda invoke` → S3 → 下载。
- **背景音乐**：ffmpeg 原创合成的无版权氛围垫乐（正弦叠加 + 慢 tremolo + 低通 + 首尾淡入淡出），压到 **−24dB 垫底**，远低于旁白，人声为主。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 自包含沙画动画引擎 + 12 幕分镜 + 旁白文案；暴露 `window.DURATIONS` / `window.__NARRATION` / `__animStep` 供渲染与配音流水线驱动 |
| `narrate.py` | Kokoro 逐幕合成中文旁白 → 测时长 → 生成 `durations.json` + 对齐的 `narration.wav` |
| `dump_narration.js` | 从页面导出 `window.__NARRATION` 到 `narration.json` |
| `record.js` | 注入 `DURATIONS`，逐帧确定性截图（规避无头 rAF 限流） |
| `narration.json` | 旁白文案（逐幕） |
| `assets/nyc-subway-sandart.mp4` | **成品视频** |

## 重建步骤

```bash
# 依赖：Node + playwright(含缓存 Chromium)、python venv + kokoro misaki[zh] soundfile、ffmpeg(完整版)
python3 -m venv .venv && ./.venv/bin/pip install kokoro "misaki[zh]" soundfile
npm install playwright

node dump_narration.js                 # 导出旁白文案
./.venv/bin/python narrate.py          # Kokoro 合成旁白 + durations.json + narration.wav
node record.js                         # 按旁白节奏逐帧截图 -> frames/

# 画面编码 + 混音（narration.wav 可先与背景乐混为 narration_music.wav）
ffmpeg -framerate 25 -i frames/f_%06d.png -c:v libx264 -pix_fmt yuv420p -crf 20 _video.mp4
ffmpeg -i _video.mp4 -i narration_music.wav -c:v copy -c:a aac -b:a 160k -shortest assets/nyc-subway-sandart.mp4
```

## 说明

"opus 5.5" 是编排/生成本片的推理模型，不是文生视频模型——视频像素由上面的代码管线产出，模型负责分镜、文案与管线编排。Kokoro 中文偏弱于英文，个别多音字/韵律可能有瑕疵；若追求更自然可换 CosyVoice / Qwen3-TTS 或付费神经语音（部署形态相同）。
