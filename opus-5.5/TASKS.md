# 遗留任务（2026-09-29 交接；进度更新至 2026-10-08）

**整体进度：** 03 ✅ · 04 ✅ · 05 ✅ · 06 ✅（方法1脚手架 + 方法2 LTX 成片）· 07–10 ⬜ 待办。
下一个待办是 07（开箱 ASMR）。详见下方各节。

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

- **凭证：** 用本机 EC2 实例角色（账号 <ACCOUNT_ID>，角色 `openclaw-bedrock-OpenClawInstanceRole`），`aws` 默认就走它。所有旧文档里的 `AWS_PROFILE=global_ruiliang` 都改成「用实例角色」，不再需要设 `AWS_PROFILE`。写操作若被 CLI guardrail 拦，走 boto3 SDK。
- **构建用 Kiro：** 由 KiroCrew（Kiro）自己构建，不用为编码调 Bedrock。剩下的 05–10 都是视频 / 多模态工厂活（场景、镜头、配乐、出片），本身不需要调 Bedrock；只有 `factory/story.mjs` 那种「让模型写文案」的步骤才调（04 第 6 步已用 opus-5.5 跑完）。
- **Kokoro 配音（第 7 步）：** `tts.sh` 已随并排检出的 `aws-is-how` 拉到 `ai-ml/aigc/audio_models/Kokoro/tts.sh`（`vo.mjs` 默认就找这里；也可用 `KOKORO_TTS` 指别处）。它是**远程** Kokoro——`aws lambda invoke kokoro-tts:live` 出音频再从 S3 下载，不用本地装模型。**但这个 Lambda 目前没部署在本账号**（us-east-1/us-west-2/ap-southeast-1 都没有 `kokoro-tts` 函数），要先按 `Kokoro/README.md` 的 `build.sh`+`deploy.sh` 部署（建 ~1GB ECR 镜像、6GB SnapStart Lambda≈$20+/月、S3、IAM 角色——花钱且要 Docker，动手前先跟用户确认）。声音：已部署的 Lambda 装着 Kokoro-82M 全部音色，按首字母选管线（a 美英、b 英英、z 中文），`zf_*`/`zm_*`/`af_*`/`am_*`/`bf_*`/`bm_*` 都能用；Kokoro README 只列了推荐的几个（2026-09-30 实测 `bf_emma`、`zf_xiaoxiao`、`af_heart` 都能出声）。用户在 EC2 上不方便试听，直接看最终网页效果，不再要求先 `--audition`。
- `03-perfume/test/preview.test.mjs` 会起 Chromium，要 GPU 和网络；本机无 GPU（SwiftShader 软件渲染被 `browser.mjs` 拒绝），preview / check.mjs 的渲染测试失败不代表代码坏了，先看报错。`npm test` 现约 226 过 / 4 失（全是这些 preview 测试）/ 5 跳
- `*/out/`、`.scratch/` 不入库：渲染出的视频和样张云端都没有

## 1. 04 年度购物报告（✅ 完成，已在 master；2026-09-30 用户验收通过）

已完成：引擎（say.js、story.js、story.mjs、grade.js）、数据、脚手架、六个镜头都用实物模型做完并过了样张。2026-09-29 用户定下：

- 计数镜头的字幕不带数字，只给上面的大数字作注释（`captions.count` 没有占位符）
- 营地灯、耳机照实物建模（`js/models/product.js` 的 `lantern`、`headset`）；耳机在 gamer 深色背景上偏暗，用户说不用再调
- 英文推荐卡用单数名（`catalog.js` 的 `one`）

接下来按 spec §14：

- [x] **第 5 步 配乐和音效：**（2026-09-29 完成：`js/score.js` 按镜头写、按剪辑表摆放，15 / 6 秒共用；`test/score.test.mjs` 10 条，混音两遍逐采样相同在无头 Chromium 里测，不要 GPU；四位顾客 × 两个剪辑过了 −14 LUFS / 真峰值 −1.6 dBTP）照 spec §10 写 `04-year-review/js/score.js`，在 `film.js` 里导出 `score`（参照 03）。D 大调 80 bpm；months 的柱子音高按每月订单数映到五声音阶，每位顾客的旋律不同。补 §12 的测试：每个命中点落在 0.75 s 网格上，同一混音渲两次样本一致。响度 −14 LUFS、真峰值 ≤ −1 dBTP（引擎已经管）
- [x] **第 6 步 Bedrock 写文案：**（2026-09-29 完成：用本机实例角色 `AWS_REGION=us-east-1`、默认模型 `us.anthropic.claude-opus-5-5` 真调 Bedrock，四份 `stories/*.json` 的 `model` 从 `draft` 换成 opus-5.5，各一次尝试过 check；顺带修 `story.mjs` 的 `toolChoice`——opus-5.5 不支持强制 `tool`/`any`，改成 `auto`）先看 `--dry` 提示词；四份 `stories/*.json` 的 `model` 不再是 `draft`，每份最多三次尝试
- [x] **第 7 步 配音（Kokoro，远程）：**（2026-09-29 完成：Kokoro 部署在账号 <ACCOUNT_ID> 的 `kokoro-tts:live`，用户授了跨账号 InvokeFunction + `s3://aicoding-ruiliang/tts-out/*` 读；本机 arm64 用 `ffmpeg-static`+`@ffprobe-installer/ffprobe` 提供 ffmpeg/ffprobe；声音 zh=`zm_yunjian`、en=`am_michael`；`node factory/vo.mjs 04-year-review` 生成全部 64 句，每句落在时段内，−20 LUFS，入库 `assets/vo/`）
- [x] **第 8 步 出片和收尾：**（2026-09-29 完成：`opus55-render` 角色+实例配置文件已建、OpenClaw 角色获 PassRole/GetInstanceProfile；`cloud.mjs up` 在 <ACCOUNT_ID> 本账号启动 g5.2xlarge（A10G，g6/g5.4xl 无容量）→ `render 04-year-review` 全绿 → `pull` → `down` 已终止实例。交付清单 `manifest.json` 已改为 6 条（主片 coffee/baby、海外 camp/gamer、双11 baby/gamer）。成片在 `04-year-review/out/`（`out/` 按 .gitignore 不入库）。README 与根索引已写。Level 3 说明已核对（PR #3）；2026-09-30 用户看过成片，验收通过）
- [x] 每做完一步就提交，告诉用户可以推送（全部经 PR #1–#5 合入；本地的 `opus55-04-year-review` 分支和 master 一样，已经没用了）

## 2. 05–10：`factory/Video-Factory.md` 的场景 B–H 里剩下的

每部都走 new-film skill：先出分镜给用户批，批了再写代码。编号（字母顺序）：

| 编号 | 场景 | 状态 | 要新加的引擎能力（各自带测试） |
|---|---|---|---|
| 05 | C 奶茶广告 | ✅ 完成 | `bake.js`（在 `setup` 里定步长模拟，按 t 查表）；把 03 的玻璃 shader 挪成共用模块 |
| 06 | D 丝巾 | ✅ 完成（方法1脚手架 + 方法2 LTX 成片，详见 §2.06） | `bake.js`（布料） |
| 07 | E 开箱 ASMR | ⬜ 待办 | `audio.js` 加拟音（胶带、纸） |
| 08 | F 一个包裹的旅程 | ⬜ 待办 | `bake.js`（机器人群路径） |
| 09 | G 双11 零点大屏 | ⬜ 待办（地图已定：订单星座布局） | 「订单星座」布局（不画地理边界） |
| 10 | H 直播间秒杀 motion pack | ⬜ 待办 | — |

**G 的地图已定（2026-09-30）：** 用户拍板改用不画地理边界的「订单星座」布局，不用标准地图。背景：用户提过用自然资源部的标准地图（带审图号）再叠城市灯光和弧线。按 2025 年的规定，标准地图只有原样使用才不用送审，叠加、缩放、裁剪、改色都算修改，要重新送审（只能法人申请，约 20 个工作日）。所以不走标准地图。

### 05 奶茶广告（2026-09-30 分镜已批）

用户定下：
- 品牌「啵茶 BOCHA」（虚构，README 写明）。第一轴 `flavor`：`brownsugar` 黑糖珍珠（默认）、`jasmine` 茉莉奶绿、`strawberry` 草莓啵啵、`taro` 芋泥。
- 价格一律整数（`sayNum` 只读整数），如 ¥22 → 双11 ¥15，$7 → $5。
- 配音：中文 `zf_xiaoyi`，英文 `af_heart`。
- 顺序：先把两件引擎能力各自做完、带测试、合进 master，再写 05 的代码。

分镜草案（镜头表、剪辑表、配音台词、效果的确定性做法、风险与简化方案）在 2026-09-30 由 Opus 5.5 起草，要点：15 秒 = pearls 2.25 · pour 2.25 · ice 1.5 · hero 3 · straw 3（刺破 9.75）· end 3；6 秒 = ice · straw（from 0.75）· end，只出 1:1 双11；清单 4 款 × 3 = 12 条。奶花若做成烟雾感，退回「奶层带波浪界面往下沉」。

- [x] 引擎 1（PR #7 已合）：`factory/engine/bake.js`（定步长模拟烘成表，按 t 插值取样；确定、可乱序取样、烘焙 < 1.5 s）
- [x] 引擎 2（PR #8 已合，03 像素不变）：03 的分层折射抽成共用模块，支持凸棱柱（03）和薄壁圆台（05 的杯子）；03 生成的 GLSL 逐字节不变，云 GPU 上 `check.mjs 03-perfume` 全过
- [x] 05 成片（2026-09-30：用户批了画面方向；第二阶段加了奶柱、冰块浮起、冷凝画到 over 层、四款口味加对比、完整配乐、64 句 Kokoro 配音；云 GPU `check.mjs` 全过，12 条出片 −14 LUFS）

### 06 丝巾（2026-10-01 分镜已批）

用户定下：四款**四套不同的分镜**（不只是换皮），场景、光、配乐也各不相同。品牌「锦时 JINSHI」（虚构）。第一轴 `scarf`：`dunhuang` 敦煌藻井（默认）、`songjin` 宋锦八达晕、`qinghua` 青花缠枝莲、`yunhe` 云鹤。价格 ¥399 → 双11 ¥299，$59。交付 4 × 3 = 12 条。

- [x] 引擎（PR #12 已合）：`film.cutFor(v)` 剪辑表按变体取；`factory/engine/cloth.js` 布料（建在 bake.js 上）
- [x] 06 脚手架 + 四套分镜逐个做（分支 `opus55-06-scarf`）
- [x] 06 **方法2（LTX-2.5 文生视频）完成** 2026-10-08：四款 20 镜头经分镜写提示词、在 EC2 g6e.2xlarge(L40S) 用 LTX-2.5 文生视频生成（`gen/gen_batch.py`，fp8+sequential offload，704×480/24步，每镜头出完即传 S3 + AUTO_POWEROFF）；后期 `gen/post.py`（ffmpeg 裁剪+xfade转场+Pillow字幕overlay+片尾卡+Kokoro配音混音）产出 manifest 的 12 条 gallery 成片（4款×{15s/16x9/zh/none、15s/16x9/en/launch、6s/1x1/zh/1111}）。成片在 `out/films/`，S3 存档 `s3://cdh-ingest-demo/showcase-ltx/06-silk-scarf/films/`。详见 `gen/DEPLOYMENT-method2.md`。局限：配乐缺失（score.js 是 WebAudio 程序配乐，ffmpeg 后期用不了）；字幕用简化安全区定位非逐镜头 zone。

分镜（0.75 s 网格；15 s，片尾 `end` 12–15 共用；6 s = 两个镜头各 1.5 s + `end` 3 s）：
- **敦煌「飞天」**：cave 0–2.25 风掀起石台上的丝巾 · fly 2.25–5.25 飘带般盘旋上升 · ceiling 5.25–7.5 仰拍在藻井下展开、纹样对上藻井 · drape 7.5–10.5 落人台肩 · hero 10.5–12 环绕。烛光洞窟，琵琶 + 手鼓。6 s：ceiling → drape → end
- **宋锦「织」**：warp 0–3 光作梭逐行织出纹样 · weave 3–5.25 拉远织成 · lift 5.25–8.25 两角提起离机慢动作起伏 · fold 8.25–10.5 空中三折 · box 10.5–12 落盒合盖（无人台）。素绢屏风天光，古琴 + 箫无鼓。6 s：weave → fold → end
- **青花「瓷」**：paint 0–3 毛笔在白瓷瓶上画缠枝莲 · bloom 3–4.5 钴蓝晕开 · slip 4.5–8.25 纹样化作丝巾裹瓶滑落堆在白台 · pool 8.25–10.5 褶子微距高光流过 · hero 10.5–12 升起俯看。白瓷影棚冷硬光，钢片琴 + 弦乐。6 s：bloom → slip → end
- **云鹤「鹤」**：dusk 0–2.25 暮色云海明月 · crane 2.25–5.25 两角上下扇动如鹤展翅掠过月亮 · glide 5.25–7.5 贴身跟拍鹤纹 · land 7.5–10.5 收翅落逆光人台肩 · hero 10.5–12 慢推。暮色天幕逆光，合成器 + 笙。6 s：crane → land → end

共同：字幕「桑蚕丝 · 十六姆米」；片尾卡同 05 的三种；配音每款 hook / hero / end + 6 s 一句，台词按各自分镜写，数字念成字；声音建议 zh `zf_xiaoxiao`、en `bf_emma`（待用户定）。风险：青花裹瓶滑落、云鹤扇翅（退路：缩短或按脚本过渡）；不做布自碰撞。

## 3. 03 香水的遗留

- [x] 03 的 Kokoro 配音片段（`03-perfume/assets/vo/`）：2026-09-30 用户验收通过
- [x] 最终评审暂缓的小问题（2026-09-30 用户评审通过，按现状关闭，不修）：
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
