# 06 丝巾 · 方法2（LTX-2.5 文生视频）部署与流程记录

记录于 2026-10-08。本文件记录「方法2」端到端流程、用到的云资源、复现步骤与已知局限。
方法2 = Opus 写分镜+提示词 → 开源视频模型（LTX-2.5）在 EC2 GPU 文生视频 → ffmpeg 后期合成成片。
（方法1 = Three.js/WebGL 程序化渲染，仍保留在本目录 `js/`、`film.js` 等，未删除。）

## 产物

- **20 个 per-shot clip**（704×480 / 24fps / ~3.04s，H.264）：四款 × 5 镜头。本地 `gen/ltx_mp4/`，S3 `s3://cdh-ingest-demo/showcase-ltx/06-silk-scarf/mp4/`。
- **40 张首尾帧**：`gen/ltx_frames/`，S3 `.../frames/`。
- **12 条 gallery 成片**（见 `manifest.json` 三组变体）：本地 `out/films/`，S3 `.../films/`。
  - `jinshi_<scarf>_15s_16x9_zh.mp4`（标语片尾）× 4
  - `jinshi_<scarf>_15s_16x9_en_launch.mp4`（英文 + 新品首发）× 4
  - `jinshi_<scarf>_6s_1x1_zh_1111.mp4`（方版 + 双11价签）× 4

（clip / 帧 / 成片都是二进制，不入 git，只在本地 + S3；gitignore 已排除 `gen/ltx_*`、`out/films`、`gen/vo_cache`。）

## 生成管线（`gen/`）

| 文件 | 作用 |
|---|---|
| `prompts.json` | 20 镜头的文生视频提示词（per-shot，photoreal real footage，无文字无水印；字幕/logo 后期叠） |
| `setup_ltx.sh` | GPU 实例上装 LTX-2.5 推理环境（torch cu124 + diffusers git 源 + 权重拉到 NVMe） |
| `gen_batch.py` | 批量文生视频：LTX2Pipeline（fp8 layerwise + **sequential** cpu offload）；每镜头 MP4+首尾帧；**每出一个即传 S3**（`_s3_push`）+ `BATCH_DONE` 后全目录 sweep + `AUTO_POWEROFF=1` 跑完自动关机 |
| `drive_oneshot.sh` / `drive_redo15.sh` | 逐镜头独立进程跑 gen_batch（规避 g6e host-RAM 跨镜头 OOM），断点续跑 |
| `s3_backup.py` | 把 clip/帧补传 S3 |
| `export_boards.mjs` / `export_captions.mjs` | 从 `meta.js`/`copy.js`/`scarves.js` 导出 `boards.json`/`captions.json` 供后期用 |
| `post.py` | **后期合成**：按 BOARDS 裁剪 + xfade 转场 + Pillow 字幕 overlay + 片尾卡 + Kokoro 配音混音 → 成片 |

## 云资源

- **GPU 实例**：EC2 `g6e.2xlarge`（NVIDIA L40S 48GB），区域 **ap-northeast-1（东京）**——us-east-1/us-west-2 的 g6e 当时 InsufficientInstanceCapacity，用 spot placement score 选到东京有容量。实例通过 `factory/cloud.mjs` 的 `opus55-render` 机制开/关（自带关机期限 cron）。**用完已 terminate，零计费。**
- **S3**：`cdh-ingest-demo`，前缀 `showcase-ltx/06-silk-scarf/`（mp4/ frames/ films/）。
- **Kokoro TTS**：lambda `kokoro-tts`（us-east-1，无别名，用 bare 函数名；`:live` 别名不存在）。中文 `zf_xiaoxiao`、英文 `bf_emma`（lambda 实际支持，`tts.sh` 注释漏列 zf_/bf_ 系列）。

## 复现步骤

```bash
# 1. 开 GPU（东京）
cd opus-5.5 && AWS_REGION=ap-northeast-1 node factory/cloud.mjs up --type g6e.2xlarge --hours 8
# 2. 同步代码 + 装环境（HF_TOKEN 从 ~/.env）
ssh -F ~/.ssh/opus55-render.config opus55-render 'cd showcase/06-silk-scarf/gen && HF_TOKEN=... bash setup_ltx.sh && venv/bin/pip install boto3'
# 3. 批量文生视频（每镜头即传S3，跑完自动关机）
ssh ... 'cd .../gen && HF_TOKEN=... S3_BUCKET=cdh-ingest-demo S3_PREFIX=showcase-ltx/06-silk-scarf AUTO_POWEROFF=1 venv/bin/python gen_batch.py'
# 4. 本地后期（纯 CPU，无需 GPU）
#    需要带 H.264 解码 + 的 ffmpeg（imageio-ffmpeg）+ Pillow：
FFMPEG=$(python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
  python gen/post.py          # 出全部 12 条到 out/films/
```

## 关键坑（已解决，供复用）

1. **AWS lambda-microvms 式容量**：g6e 美国区容量紧，用 `aws ec2 get-spot-placement-scores` 跨区选容量，东京/孟买评分 9。
2. **LTX-2.5 显存**：13B transformer + Gemma-4 文本编码器 + diffusion decoder + audio vae，`enable_model_cpu_offload()` 在 48G 上峰值 OOM（挂在 `encode_prompt`）。改 `enable_sequential_cpu_offload()` + 704×480 稳定（每镜头 ~8–9 分钟）。
3. **产出易丢**：clip 在实例本地 NVMe，实例 terminate 即销毁。必须每镜头即传 S3（`_s3_push`）+ `AUTO_POWEROFF` 跑完即关，不靠外部监控赶 deadline。
4. **本机两个 ffmpeg 各缺一半**：Playwright 版缺 H.264 解码器（读不了 clip）；imageio-ffmpeg 版缺 `drawtext` 滤镜（烧不了字幕）。解法：解码/拼接/xfade 用 imageio-ffmpeg，字幕改用 **Pillow 渲染透明 PNG + overlay** 绕开 drawtext。
5. **Kokoro**：`:live` 别名不存在（用 bare `kokoro-tts`）；`tts.sh` 注释没列 zf_/bf_ 女声，但 lambda 实际支持。

## 已知局限（未做 / 待迭代）

- **配乐缺失**：`score.js` 是方法1 的 WebAudio 程序配乐，ffmpeg 后期调不了；成片目前只有配音没有 bgm。
- **字幕定位简化**：用统一安全区（左下/居中），非 `layouts.js` 的逐镜头像素级 zone 坐标。
- **clip 时长**：LTX 固定 73 帧≈3.04s，剪辑表个别镜头要 3.75s（如 qh_slip），用 setpts 轻微慢放补足。
- **9:16 未交付**：manifest 只要 16:9 和 1:1。
