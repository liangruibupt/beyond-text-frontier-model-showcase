# 07 开箱 ASMR — 方法2 部署与过程记录

复用 06 丝巾的方法2 管线（`gen_batch.py`/`post.py`/`gen_index.mjs`），本文件只记 07 新增与本次踩的坑。

## 新增能力

- **`gen/sfx.py` — ASMR 拟音程序合成**：numpy 合成五种音效，用标准库 `wave` 写 WAV（不依赖 scipy）。固定 per-sound seed（**不用 `hash()`**——PYTHONHASHSEED 随机化会破坏跨进程确定性）。`post.py` 的 `SFX_MAP` 定义每镜头音效事件（名/相对偏移/增益），`mix_audio()` 把旁白 + SFX 一起 adelay+amix 进音轨，xfade 重叠量在算绝对起点时扣除。
- 成片命名前缀 `kaiwu_`；S3 前缀 `showcase-ltx/07-unboxing`（**本账号该前缀无写权限，上传 AccessDenied**——产出靠 scp 拉回，不影响交付）。

## 本次关键坑（务必记住）

1. **多 session 共用同一 GPU 实例互相覆盖**：`cloud.mjs` 资源名硬编码 `opus55-render`、远端目录硬编码 `~/showcase/`，`cloud.mjs run` 带 `rsync --delete` 从调用方 worktree 全量覆盖远端。06 与 09 两个 worktree 同时用这台机时互删对方的 film 目录。
   **解法**：`cloud.mjs` 内建 `OPUS55_INSTANCE` 环境变量换实例名（如 `opus55-ltx07`）→ 独立实例/ssh钥匙/tag，物理隔离。给每个并行视频任务一台独立实例。**不要**改 `cloud.mjs`（共享引擎）。

2. **跨会话要保留的素材别放 `$KIROCREW_SCRATCH`**：它是 per-runtime 目录，会话压缩/恢复后 runtime id 变，旧 scratch 被回收。本次 drone 原始 clip 因此丢失、被迫重生成。**解法**：持久素材放仓库内 `assets_backup/`（.gitignore 排除）。

3. **监控 gate 循环可能卡住不推进**：gate 式监控（`monitor_start`）靠"检测到状态变化"wake，生成已 DONE 但 gate 未触发时，后期步骤不会自动跑，实例空转烧钱。**解法**：多步收尾不要全交给 gate 监控；关键节点（生成完成/实例空闲）主动 ssh 查，手动推进。

4. **`pgrep -f gen_batch.py` 会误匹配 ssh 命令行自身** → 永远显示 RUNNING。以日志的 `*_DONE` 标记或产出文件数为准，别信 pgrep。

5. **GPU 容量**：L40S 48G，单个 LTX-2.5(fp8+sequential offload) 峰值 ~20-24G；同机**串行**跑多个 batch 没问题，**并行两个推理进程**会 OOM。

## 产出

- 6 条成片 `out/films/kaiwu_{item}_{cut}s_{ar}_{lang}[_promo].mp4`，带 Kokoro 配音 + ASMR 拟音。
- 10 clip + 20 帧备份 `assets_backup/`。
- 画廊 `factory/gallery.html?film=07-unboxing`。
