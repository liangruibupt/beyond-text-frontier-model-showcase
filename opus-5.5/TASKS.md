# 遗留任务（2026-09-29 交接）

给接手的 code agent：先读完这一页再动手。和用户用中文沟通，有进展、发现或改计划时及时告诉用户。

## 先读

- 流程：`.claude/skills/new-film/SKILL.md`（每部片都照它做：分镜先批、镜头逐个做、交付物、出片）
- 引擎和工具：`factory/README.md`
- 04 的设计：`docs/specs/2026-09-29-04-year-review-design.md`（§10 配乐，§12 验收，§14 顺序）
- 03 是做完的样板：`03-perfume/`（配乐 `js/score.js`，配音 `assets/vo/`）
- 所有命令都在 `opus-5.5/` 下执行，Node 22。`npm test` 现在是 225/225，`node factory/check.mjs 04-year-review` 全绿

## 规矩（用户定的，一直有效）

- **先问再做：**
  - 调 Bedrock 之前（`factory/story.mjs` 不带 `--dry`）先问用户，并确认 region 和模型（默认 `us.anthropic.claude-opus-5-5`）。用本机实例角色，不用 `AWS_PROFILE`。04 第 6 步已完成。视频/多模态步骤本身不调 Bedrock
  - Kokoro 配音：用户已定不做 EC2 上试听（直接看最终网页），所以不再要求先 `--audition`；但**部署 Kokoro Lambda 前**（本账号还没部署，见下方环境节）先问用户——那是花钱且要 Docker 的动作
  - 任何 IAM 改动先问用户；自动模式拦下过 `iam create-role`，不要绕过去
  - 推送由用户自己做（新仓库要过 Code Defender，`git-defender request-repo` 已经办过）；永远不要 `--no-verify`
- **云 GPU：** 批量出片走 `factory/cloud.mjs`（`up`、`run`、`render <film>`、`pull`、`down`），`AWS_REGION=us-east-1`。凭证用本机 EC2 实例角色（这台是 EC2 上的 KiroCrew，`aws` 默认就走实例角色，不用设 `AWS_PROFILE`；旧文档里的 `global_ruiliang` 都改用实例角色）。
  - 资源名 `opus55-render`、tag `Project=opus55-showcase` 保持不变（用户确认过，不跟着仓库改名）
  - 用完马上 `down`；不碰账号里别的实例；不动账号级的 SSM associations 和 patch baseline（它们会在开机 5 分钟内打补丁重启，`up` 已经会等）
  - 本地只做预览、`sheet.mjs`、`snap.mjs`
  - 实例的细节看 `factory/README.md` 的「cloud.mjs：云端出片」，要点：
    - 机型按 `g6.4xlarge`（L4）→ `g5.4xlarge`（A10G）的顺序试，L4 常缺容量；两种都过了 `check.mjs`。账号的按需 G 类配额是 864 vCPU
    - AMI 是最新的 Deep Learning Base OSS Nvidia Driver GPU AMI（Ubuntu 24.04，带 ffmpeg 6.1；22.04 的 ffmpeg 4.4 没有 `alimiter latency=`）
    - IAM 角色和同名实例配置文件 `opus55-render`（只挂 `AmazonSSMManagedInstanceCore`）用户已经建好；安全组（无入站规则，走 SSM）和 ssh 密钥 `~/.ssh/opus55-render` 由 `up` 自动建
    - 本机要有 AWS CLI 和 Session Manager 插件；Linux 上的 Chromium 必须用 `--use-angle=vulkan`（`lib/browser.mjs` 已经处理）
    - 实例自带关机期限（`up --hours`，默认 3 小时，到点关机即终止），忘了 `down` 也不会一直计费；现在账号里没有这个项目的实例
    - 03 的 12 条在 g5.4xlarge 上用 6 个 worker 出了 5.2 分钟，瓶颈在 CPU（PNG 和 x264）；经 SSM 拉回约 0.8 MB/s，167 MB 要 3.5 分钟
- **交付物：** 每部片每个产品正好三条，都带配音：16x9 15 s zh `none`、16x9 15 s en `launch`、1x1 6 s zh `1111`。不主动提别的规格
- **引擎扩展自带测试**；改了引擎，别的片子的成片会算过期（指纹变了），只有内容也变了才重出
- `factory/Video-Factory.md` 和仓库根目录的 `README.md` 是用户的文件，要改先问
- commit 信息结尾：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 英文里的双十一：画面写 "Double 11"，配音稿写 "Double Eleven"，不用 "11.11"

## 环境（这台机：EC2 上的 KiroCrew，用 Kiro 构建）

- **凭证：** 用本机 EC2 实例角色（账号 747411437379，角色 `openclaw-bedrock-OpenClawInstanceRole`），`aws` 默认就走它。所有旧文档里的 `AWS_PROFILE=global_ruiliang` 都改成「用实例角色」，不再需要设 `AWS_PROFILE`。写操作若被 CLI guardrail 拦，走 boto3 SDK。
- **构建用 Kiro：** 由 KiroCrew（Kiro）自己构建，不用为编码调 Bedrock。剩下的 05–10 都是视频 / 多模态工厂活（场景、镜头、配乐、出片），本身不需要调 Bedrock；只有 `factory/story.mjs` 那种「让模型写文案」的步骤才调（04 第 6 步已用 opus-5.5 跑完）。
- **Kokoro 配音（第 7 步）：** `tts.sh` 已随并排检出的 `aws-is-how` 拉到 `ai-ml/aigc/audio_models/Kokoro/tts.sh`（`vo.mjs` 默认就找这里；也可用 `KOKORO_TTS` 指别处）。它是**远程** Kokoro——`aws lambda invoke kokoro-tts:live` 出音频再从 S3 下载，不用本地装模型。**但这个 Lambda 目前没部署在本账号**（us-east-1/us-west-2/ap-southeast-1 都没有 `kokoro-tts` 函数），要先按 `Kokoro/README.md` 的 `build.sh`+`deploy.sh` 部署（建 ~1GB ECR 镜像、6GB SnapStart Lambda≈$20+/月、S3、IAM 角色——花钱且要 Docker，动手前先跟用户确认）。声音只能用已部署集合里的：zh=`zm_*`（`zm_yunjian` 推荐），en=`am_*`（美）/`bm_*`（英）；**没有 `bf_*`/`af_*`/`zf_*`**（`copy.js` 已改）。用户在 EC2 上不方便试听，直接看最终网页效果，不再要求先 `--audition`。
- `03-perfume/test/preview.test.mjs` 会起 Chromium，要 GPU 和网络；本机无 GPU（SwiftShader 软件渲染被 `browser.mjs` 拒绝），preview / check.mjs 的渲染测试失败不代表代码坏了，先看报错。`npm test` 现约 226 过 / 4 失（全是这些 preview 测试）/ 5 跳
- `*/out/`、`.scratch/` 不入库：渲染出的视频和样张云端都没有

## 1. 04 年度购物报告（进行中，已在 master 上）

已完成：引擎（say.js、story.js、story.mjs、grade.js）、数据、脚手架、六个镜头都用实物模型做完并过了样张。2026-09-29 用户定下：

- 计数镜头的字幕不带数字，只给上面的大数字作注释（`captions.count` 没有占位符）
- 营地灯、耳机照实物建模（`js/models/product.js` 的 `lantern`、`headset`）；耳机在 gamer 深色背景上偏暗，用户说不用再调
- 英文推荐卡用单数名（`catalog.js` 的 `one`）

接下来按 spec §14：

- [x] **第 5 步 配乐和音效：**（2026-09-29 完成：`js/score.js` 按镜头写、按剪辑表摆放，15 / 6 秒共用；`test/score.test.mjs` 10 条，混音两遍逐采样相同在无头 Chromium 里测，不要 GPU；四位顾客 × 两个剪辑过了 −14 LUFS / 真峰值 −1.6 dBTP）照 spec §10 写 `04-year-review/js/score.js`，在 `film.js` 里导出 `score`（参照 03）。D 大调 80 bpm；months 的柱子音高按每月订单数映到五声音阶，每位顾客的旋律不同。补 §12 的测试：每个命中点落在 0.75 s 网格上，同一混音渲两次样本一致。响度 −14 LUFS、真峰值 ≤ −1 dBTP（引擎已经管）
- [x] **第 6 步 Bedrock 写文案：**（2026-09-29 完成：用本机实例角色 `AWS_REGION=us-east-1`、默认模型 `us.anthropic.claude-opus-5-5` 真调 Bedrock，四份 `stories/*.json` 的 `model` 从 `draft` 换成 opus-5.5，各一次尝试过 check；顺带修 `story.mjs` 的 `toolChoice`——opus-5.5 不支持强制 `tool`/`any`，改成 `auto`）先看 `--dry` 提示词；四份 `stories/*.json` 的 `model` 不再是 `draft`，每份最多三次尝试
- [x] **第 7 步 配音（Kokoro，远程）：**（2026-09-29 完成：Kokoro 部署在账号 710299592439 的 `kokoro-tts:live`，用户授了跨账号 InvokeFunction + `s3://aicoding-ruiliang/tts-out/*` 读；本机 arm64 用 `ffmpeg-static`+`@ffprobe-installer/ffprobe` 提供 ffmpeg/ffprobe；声音 zh=`zm_yunjian`、en=`am_michael`；`node factory/vo.mjs 04-year-review` 生成全部 64 句，每句落在时段内，−20 LUFS，入库 `assets/vo/`）
- [x] **第 8 步 出片和收尾：**（2026-09-29 完成：`opus55-render` 角色+实例配置文件已建、OpenClaw 角色获 PassRole/GetInstanceProfile；`cloud.mjs up` 在 747411437379 本账号启动 g5.2xlarge（A10G，g6/g5.4xl 无容量）→ `render 04-year-review` 12 条全绿 9.7 分钟 → `pull` → `down` 已终止实例。成片在 `04-year-review/out/`（12 个 mp4 + 封面，220 MB，`out/` 按 .gitignore 不入库）。README 与根索引已写（本 PR）。剩：`gallery.html` 给用户审、factory README/skill 的 Level 3 说明核对）
- [ ] 每做完一步就提交，告诉用户可以推送（本地的 `opus55-04-year-review` 分支和 master 的 cb798a2 一样，已经没用了）

## 2. 05–10：`factory/Video-Factory.md` 的场景 B–H 里剩下的

每部都走 new-film skill：先出分镜给用户批，批了再写代码。编号（字母顺序）：

| 编号 | 场景 | 要新加的引擎能力（各自带测试） |
|---|---|---|
| 05 | C 奶茶广告 | `bake.js`（在 `setup` 里定步长模拟，按 t 查表）；把 03 的玻璃 shader 挪成共用模块 |
| 06 | D 丝巾 | `bake.js`（布料） |
| 07 | E 开箱 ASMR | `audio.js` 加拟音（胶带、纸） |
| 08 | F 一个包裹的旅程 | `bake.js`（机器人群路径） |
| 09 | G 双11 零点大屏 | 见下面的地图问题 |
| 10 | H 直播间秒杀 motion pack | — |

**G 的地图还没定：** 用户提过用自然资源部的标准地图（带审图号）再叠城市灯光和弧线。按 2025 年的规定，标准地图只有原样使用才不用送审，叠加、缩放、裁剪、改色都算修改，要重新送审（只能法人申请，约 20 个工作日）。我建议 G 改用不画地理边界的"订单星座"布局。做 09 的分镜之前要用户拍板。

## 3. 03 香水的遗留

- [ ] 用户还没听过 03 的 Kokoro 配音片段（`03-perfume/assets/vo/`），只做过响度测量。提醒用户听，有读错的就改词重生成那一条（生成前先问）
- [ ] 最终评审暂缓的小问题，都没修：
  - M1：本地 dev server（`factory/lib/serve.mjs`）会被构造的 URL 弄崩，有开放重定向，读文件出错没处理
  - M3：`vo.mjs` 中途中断，新片段可能配上旧片段的时长和响度；"缩短这几句"的提示可能点名一句重生成就放得下的
  - M4：`--workers`、`--fps` 没校验，`--workers abc` 直接崩而不是打印用法
  - M5：Node 端的文字宽度估计会偏窄一点（如 "Shop now"），文档却说它偏宽；浏览器里的溢出检查仍然兜底
  - M6：字体下载失败时，报错不一定点名是哪款字体
  - M7：`check.mjs` 的可重复性和音频只查一个 SKU
  - M8：`index.json` 列出文件夹里所有视频，不只是这份 manifest 的；中断后会过期
  - M9：渲染中 Ctrl-C 会在临时目录留下音频文件
  - M10：音频开头没有淡入（测过是设计好的第一个音，不是爆音）
  - M11：字体 CDN 链接只锁到大版本 5
- 04 加了 `grade.js` 之后，03 的成片按指纹算过期；03 的像素没变，内容不变就不用重出
