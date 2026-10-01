# factory · 商品视频工厂引擎

03 起各案例共用的引擎。一部成片（film）只提供数据和镜头函数：轴、剪辑表、构图、字体、场景、镜头、配乐和配音台词。其余的事都由引擎来做：时钟与剪辑表、按画面比例取景、字幕排版、后期、混音、预览页、审片工具、批量出片和成片画廊。

每一帧只由（变体, t）决定，所以拖动预览、联系表和批量出片画出的是同一帧。页面是纯静态的：原生 ES Module，[Three.js 0.170](https://threejs.org/) 经 importmap 从 jsDelivr 加载，没有构建步骤。出片时，Node 脚本用 Playwright 驱动无头 Chromium（Mac 上走 Metal，Linux 上走 Vulkan）逐帧取 PNG，经管道交给 ffmpeg。批量出片可以放到 AWS 的 GPU 实例上做（`cloud.mjs`）。

第一部用这套引擎的成片是 [03 · 闻境](../03-perfume/)。要从一段故事梗概起一部新片，可以让 Claude Code 按 [`new-film`](../.claude/skills/new-film/SKILL.md) 技能来做，技能里的约定都以本文为准。

## 准备

所有命令都在 `opus-5.5/` 下执行。下文的 `<film>` 指成片目录名，如 `03-perfume`。

```bash
cd opus-5.5
npm install                       # playwright 1.57.0；three 0.170.0 只给 Node 测试用
npx playwright install chromium   # 本机已缓存 Chromium build 1200 时可跳过
brew install ffmpeg               # render.mjs、vo.mjs 要用 ffmpeg 和 ffprobe
```

出片必须用 GPU：`openFilm` 拿到的 WebGL 渲染器如果是 SwiftShader 之类的软件实现，会直接报错，不会用软件渲染慢慢出片。

Chromium 的 GPU 后端按平台选（`lib/browser.mjs`）：Mac 用 ANGLE + Metal，Linux 用 ANGLE + Vulkan。Linux 上不指定后端会落到 SwiftShader。在 NVIDIA A10G 上试过，ANGLE + GL/EGL 也能拿到 GPU，但 `check.mjs` 的确定性检查不过（同一帧顺着画和倒着画不一样），所以不用它。要换一组参数试，设环境变量 `FACTORY_GPU_ARGS`（空格分隔），它会替换掉按平台选的那一组。

## 目录

```
factory/
├── engine/                 浏览器端（Node 测试也直接 import 其中的纯函数）
│   ├── app.js              主循环：变体 → 剪辑表 → 镜头 → 取景 → 渲染 → 后期 → 字幕；boot()、createApp()
│   ├── variant.js          轴、URL / 清单解析、网格展开、画面尺寸、安全区、最小字号
│   ├── timeline.js         剪辑表 → 任意 t 在哪个镜头、镜头本地时间、转场状态
│   ├── framing.js          取景意图 + 画面比例 → 相机位置与 view offset
│   ├── text.js             分词、折行（中文按字 + 避头尾，英文按词）、自动缩字、图层绘制
│   ├── post.js             MSAA → 景深 → 泛光 → AgX + 调色 + 暗角 + 颗粒 + 闪白 / 叠化
│   ├── refract.js · refract-shape.js   容器 + 液体的分层折射与地面焦散（凸棱柱 / 薄壁截锥），见「分层折射」
│   ├── audio.js            合成音色、离线混音、配音排布与压低配乐、预览发声
│   ├── mix.js · rng.js · ease.js · particles.js   纯函数工具：压低曲线、WAV、种子随机数、缓动、闭式漂移粒子
│   ├── bake.js             烘焙模拟：固定步长跑一遍存表，按 t 插值取样（碰撞这类闭式写不出的物理）
│   ├── cloth.js            布料：方格布建在 bake.js 上（位置型约束、限拉伸、风、可动的固定点、球 / 胶囊 / 圆柱 / 地面碰撞）
│   ├── say.js              配音里数字、年份、月份的读法
│   ├── story.js            Level 3 文案的纯函数：数据指纹、占位符、查模型自己写的数字、估念多久
│   ├── player.js · player.css   预览页的播放器
│   ├── sheet.js            ?safe 安全区叠加、?sheet 联系表
│   └── exporter.js         导出：start / frame / cover / audio
├── lib/                    Node 端：serve.mjs 静态服务 · args.mjs 参数 · browser.mjs 启动 Chromium · ffmpeg.mjs 编码与响度 · jobs.mjs 选任务与记账
├── check.mjs · snap.mjs · sheet.mjs · story.mjs · vo.mjs · render.mjs · cloud.mjs   命令行工具，见下
├── gallery.html            成片画廊
└── test/                   引擎单元测试（node:test）
```

## 预览页

```bash
npm run serve
# 打开 http://127.0.0.1:8765/<film>/        例：http://127.0.0.1:8765/03-perfume/
```

`npm run serve` 起的是 `factory/lib/serve.mjs`：根目录是 `opus-5.5/`，只监听 127.0.0.1，支持 Range 请求（画廊里的视频可以拖动进度）。

页面下方是播放器：每条轴一个下拉框，还有播放 / 暂停、带镜头名的时间轴、「声音」开关（成片有 `score` 时才显示）和「HQ」开关。选择会写回网址，刷新或把网址发给别人都能打开同一个变体。

| 操作 | 作用 |
|---|---|
| `空格` | 播放 / 暂停 |
| `←` / `→` | 后退 / 前进 0.5 秒 |
| `Shift` + `←` / `→` | 后退 / 前进一帧（1/30 秒） |
| `1`–`9` | 跳到剪辑表里第 *n* 条的开头 |
| `S` | 开 / 关安全区叠加 |
| `M` | 开 / 关声音 |
| `Q` | 开 / 关高画质（关掉后像素比 × 0.6，景深采样 32 → 12） |

### 网址参数

| 参数 | 说明 | 例 |
|---|---|---|
| 轴名 | 选变体。没写的轴取第一个值；值写错时页面报错，并列出可选值 | `?sku=rose&ar=16x9&lang=en` |
| `t` | 打开时停在第几秒 | `?t=6.4` |
| `paused` | 打开时不自动播放 | `?t=6.4&paused` |
| `safe` | 安全区叠加。红色是 9:16 平台界面会盖住的区域，蓝色虚线是 4% 边距，黄色是这一镜头的字幕区 | `?safe` |
| `sheet` | 联系表：一个变体的关键帧按「比例 × 语言」拼成一张图。可以写逗号分隔的时刻，不写就取每条剪辑的 60% 处。`ar`、`lang` 可以写逗号列表，不写就取全部 | `?sheet=1,4.6&ar=9x16,1x1&lang=zh` |
| `scale` | 与 `sheet` 合用：每格缩放，取 (0, 1]，默认 0.25 | `?sheet&scale=0.2` |
| `render` | 出片模式，render.mjs 用。画布就是成片尺寸，不挂播放器；字幕溢出只报错，不画红框 | |

页面有三种模式，成片从 `ctx.mode` 读取：`live`（预览）、`sheet`（联系表）、`render`（出片）。上表之外的参数引擎不读，成片可以从 `ctx.params` 自己取，例如 03 的 `?world=studio`。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run serve` | 静态服务 `http://127.0.0.1:8765/` |
| `npm test` | 引擎与各成片的单元测试（`node --test '*/test/*.test.mjs'`） |
| `node factory/check.mjs <film>` | 出片前自检 |
| `node factory/snap.mjs <film>` | 按成片尺寸截几帧 PNG |
| `node factory/sheet.mjs <film>` | 联系表 PNG |
| `node factory/story.mjs <film>` | 请 Bedrock 上的 Claude 按数据写文案，代码查过才存（Level 3，见[story.mjs](#storymjs模型写文案)） |
| `node factory/vo.mjs <film>` | 用 Kokoro 生成配音片段 |
| `node factory/render.mjs <film>` | 批量出片 |
| `node factory/cloud.mjs render <film>` | 在 AWS 的 GPU 实例上批量出片，出完拉回本机（见[云端出片](#cloudmjs云端出片)） |
| `http://127.0.0.1:8765/factory/gallery.html?film=<film>` | 成片画廊（先 `npm run serve`） |

这些脚本在参数写错时打印用法、以状态码 2 退出；检查不通过（溢出、失败的任务等）以状态码 1 退出。每个脚本都自己起一个临时的静态服务（随机端口），不需要先 `npm run serve`。

### check.mjs：出片前自检

```
node factory/check.mjs <film-dir> [--all] [--<axis> v1,v2]
```

任务的选法和 render.mjs 相同（见[清单](#清单)）。检查以下七项，每项一行：

| 项 | 内容 |
|---|---|
| `gpu` | WebGL 渲染器（软件渲染在打开页面时就已被拒绝） |
| `fonts` | 加载上的字体，以及打开页面到第一帧的毫秒数 |
| `determinism` | 每个剪辑的关键帧（每条的 60% 处）和转场中点，先顺着画、再倒着画，两遍 PNG 逐字节相同 |
| `voice-over` | 每个变体的每一句都有片段、没过期、不超出时段；成片没有 `voLines` 时直接通过 |
| `audio` | 每个剪辑的混音渲染两遍逐字节相同、不是静音；成片没有 `score` 时直接通过 |
| `overflow` | 每个变体在每条剪辑的 60% 处画一帧，没有字幕溢出 |
| `speed` | 连画 60 帧（30 fps，含取 PNG，不含编码）的每帧毫秒数，以及按这个速度单个 worker 出完这批要几分钟 |

一个两个镜头、3 秒的演示片的输出：

```
ok    gpu          ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)
ok    fonts        700 Noto Sans SC  (1746 ms to first frame)
ok    determinism  3 frames identical forward and backward
ok    voice-over   the film has no voLines: no narration
ok    audio        3 s identical twice, peak -20.5 dBFS, 67 ms
ok    overflow     2 variants, no caption overflows  (0.0 s)
ok    speed        57 ms/frame at 1080×1080 (draw + PNG, before encoding) → manifest 180 frames ≈ 0.2 min on one worker
all checks passed
```

### snap.mjs：截几帧

```
node factory/snap.mjs <film-dir> [--t 1,6.4] [--ar 9x16] [--<axis> value] [--out dir]
```

- `--t`：逗号分隔的成片秒数，默认 `0`。
- 其余 `--键 值` 原样写进页面网址：`--sku rose --lang en` 选变体，`--safe` 叠安全区，成片自己的调试参数（如 03 的 `--world studio`）也照样生效。没写的轴取第一个值。
- 输出到 `<film>/out/snap/<文件名>_t<秒>.png`。有字幕溢出时，列出溢出的图层并以状态码 1 退出。

```
demo_coral_3s_9x16_en  1080×1920  3s  gpu: ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)
  fonts: 700 Noto Sans SC
  t=0.8 turn  104 ms  → 99-demo/out/snap/demo_coral_3s_9x16_en_t0.8.png
  t=2.4 card  103 ms  → 99-demo/out/snap/demo_coral_3s_9x16_en_t2.4.png
```

### sheet.mjs：联系表

```
node factory/sheet.mjs <film-dir> [--ar 9x16,1x1] [--lang zh,en] [--t 1,4.6] [--scale 0.25] [--safe] [--<axis> value] [--out dir]
```

同一个变体按「比例 × 语言」分行，每行是几个关键帧；成片没有 `lang` 轴时只按比例分行。`--ar`、`--lang` 不写就取全部，`--t` 不写就取每条剪辑的 60% 处，其余轴用 `--<axis> value` 固定。输出 `<film>/out/sheet/sheet_<其余轴的值>_<比例>_<语言>.png`，例如 `sheet_teal_3_on_9x16-1x1-16x9_zh-en.png`。有溢出时列出 `OVERFLOW: 9x16 en t=2.4 card.title` 这样的行，并以状态码 1 退出。

### story.mjs：模型写文案

```
node factory/story.mjs <film-dir> [--<axis> a,b] [--force] [--dry] [--model id] [--tries 3]
```

- 给有 `story.js` 的成片用（约定见[文案（story.js）](#文案storyjs)）。对 `STORY.ids`（或 `--<STORY.axis>` 给出的几个）逐个处理：
  1. 代码先算好统计，连同每个字段的占位符和字数预算写进提示词；
  2. Bedrock 上的 Claude 经工具调用 `write_story` 交回一个对象（`toolChoice=auto`，靠系统提示让模型自己调用——`us.anthropic.claude-opus-5-5` 的 Converse 不支持强制 `tool`/`any`，会报 ValidationException）；
  3. `STORY.check` 查过，才写进 `<film>/stories/<id>.json`（入库）。
- 查不过时，错误作为工具结果（`status: error`）发回同一段对话让模型改，最多 `--tries` 次（默认 3）。还不过就报出最后一次的错误，这一个不写，最后以状态码 1 结束。
- 已存的文案分五种状态：`current` 跳过（`--force` 才重写）；`draft`（手写的占位稿）、`stale`（统计变了）、`failing`（`check` 不过）、`missing` 都会重写。
- `--dry`：列出每个的状态，打印系统提示、第一个要写的提示词和工具的输入 schema，不调用模型。
- 模型默认是 `us.anthropic.claude-opus-5-5`，可用 `--model` 换。调用走 AWS CLI（`aws bedrock-runtime converse`），账号和区域用 `AWS_PROFILE`、`AWS_REGION`；在带实例角色的机器上（如 EC2 上的 KiroCrew）不用设 `AWS_PROFILE`，直接 `AWS_REGION=us-east-1 node factory/story.mjs 04-year-review`。
- 成片没有 `story.js` 时，打印用法并以状态码 2 退出。

### vo.mjs：配音

```
node factory/vo.mjs <film-dir> [--audition] [--force] [--dry] [--out dir]
```

- 按 `film.voLines` 收集所有要念的句子：配音开的全部变体，比例固定取 9x16，按 `id` 去重。然后逐句调 Kokoro，生成的片段写进 `<film.id>/assets/vo/`（mp3 + `index.json`，入库）。
- 每句按（文字、音色、语速）缓存，没变的不重新生成。台词表里已经没有的句子，连同文件一起删掉。
- 生成后裁掉首尾静音（前留 50 ms、后留 80 ms），响度统一到 −20 LUFS，峰值限在 −6 dBFS，编成 48 kbps 单声道 mp3。
- 比时段（`max`）长的句子提速重念一次，最多 1.15 倍。还放不下就报出这一句，以状态码 1 结束，这时要改短文案。
- `--dry`：只列出要生成的句子，不调 Kokoro。`--force`：全部重新生成。
- `--audition`：用 `film.audition = { 语言: [音色…] }` 里的每个候选音色，把同一段话（该语言默认变体的全部台词）各念一遍，写到 `<film>/out/audition/<语言>_<音色>.mp3`（`--out` 只对试听有效），挑好后写进成片的默认音色。
- Kokoro 走 [aws-is-how](https://github.com/liangruibupt/aws-is-how) 仓库里的 `ai-ml/aigc/audio_models/Kokoro/tts.sh`（默认找和本仓库并排检出的 aws-is-how，从 `opus-5.5/` 看是 `../../aws-is-how`；Lambda `kokoro-tts:live`，us-east-1），可以用环境变量 `KOKORO_TTS`、`REGION`、`FUNC` 改。Lambda 按「音色-秒」给输出文件起名，同一音色同时念两句会互相覆盖，所以同一音色的句子排队念，不同音色的并行。
- 成片没有 `voLines` 时，打印 `<film> has no voLines: nothing to do` 并以状态码 0 退出。

### render.mjs：批量出片

```
node factory/render.mjs <film-dir> [--all] [--<axis> v1,v2|'*'] [--fps 30] [--workers 2] [--force] [--dry] [--out dir]
```

| 选项 | 说明 |
|---|---|
| （都不写） | 按 `<film>/manifest.json` 出片 |
| `--<axis> v1,v2` | 只出命令行给的网格，没写的轴取第一个值。`'*'` 表示这条轴的全部值（要加引号，免得 shell 展开） |
| `--all` | 全部组合，配音只出 `on`。和轴选项合用时，没写的轴取全部值 |
| `--fps` | 帧率，默认 30 |
| `--workers` | 同时开几个页面，默认 2。机器上还有别的渲染在跑时可以设成 1 |
| `--force` | 已做完的也重做 |
| `--dry` | 只列出要出的片和帧数，不渲染 |
| `--out` | 输出目录，默认 `<film>/out/`。放到别处时画廊看不到 |

每条任务的流程如下：
1. 打开 `?render&paused&<变体>`，视口就是成片尺寸。
2. 页面离线混出整段 WAV，编成 AAC（见[声音](#声音)）。
3. 逐帧取 PNG，经管道交给 ffmpeg，写成 `<名>.mp4.part`。任何一帧有字幕溢出，这条就算失败。
4. 画封面。
5. 用 ffprobe 核对时长、尺寸、帧率、帧数和音轨，再量一遍成片响度。
6. 都通过后，把 `.part` 改名成 `.mp4`，写说明文件。

视频编码为 `libx264 -profile:v high -pix_fmt yuv420p -crf 18 -preset slow -movflags +faststart`。

```
99-demo: 2 videos, 180 frames at 30 fps, 2 workers → 99-demo/out
[1/2] demo_teal_3s_1x1_zh  90 frames  12.0 s (7.5 fps)  2.9 MB
[2/2] demo_coral_3s_1x1_zh  90 frames  12.2 s (7.4 fps)  3.0 MB
done 2, skipped 0, failed 0  ·  0.2 min  ·  99-demo/out/index.json
```

失败的任务打印 `FAILED` 和原因，其余任务照常继续，最后以状态码 1 结束。

### 画廊

`gallery.html?film=<film>` 读 `<film>/out/index.json`。成片按第一条场景轴分组（03 是香型），每格按真实比例显示封面，下面写着其余轴的值、文件大小、时长和响度。其余每条轴一排筛选按钮，只列出成片里出现过的值，选中状态写进网址。鼠标悬停时静音播放，点开后带声音播放。标题行显示筛选后的条数、总大小和总时长；上次出片有失败的，另起一行用红字列出。不写 `?film=` 时默认打开 `03-perfume`。

### cloud.mjs：云端出片

本机性能不够时，批量出片放到 AWS 的 GPU 实例上做。代码经 rsync 同步上去，云端跑 `render.mjs`，成片再拉回 `<film>/out/`，本机的画廊照常看。

```
node factory/cloud.mjs up [--type g6.4xlarge,g5.4xlarge] [--hours 3]   开机（已有就复用，并把关机期限重设为从现在起 --hours 小时）
node factory/cloud.mjs render <film> [render.mjs 的参数…]               同步 → 云端出片 → 拉回 <film>/out/；不写 --workers 时用 6
node factory/cloud.mjs run <命令…>                                      同步后在云端跑，如 run node factory/check.mjs 03-perfume
node factory/cloud.mjs pull <film>                                     只拉回 <film>/out/
node factory/cloud.mjs extend --hours 2                                关机期限改为从现在起 2 小时
node factory/cloud.mjs status                                          实例、关机期限、GPU 占用
node factory/cloud.mjs down                                            终止实例
```

账号和区域用 AWS CLI 自己的环境变量；在带实例角色的机器上（如 EC2 上的 KiroCrew）不用设 `AWS_PROFILE`，直接 `AWS_REGION=us-east-1 node factory/cloud.mjs up`。本机要装 AWS CLI 和 [Session Manager 插件](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)。

用到的资源都叫 `opus55-render`，都打了 `Project=opus55-showcase` 标签：

| 资源 | 说明 | 谁来建 |
|---|---|---|
| IAM 角色和同名实例配置文件 | 只挂 `AmazonSSMManagedInstanceCore` | 要先由人建好，`up` 找不到就报错退出 |
| 安全组 | 默认 VPC 里，没有入站规则 | `up` 没找到就建 |
| ssh 密钥 | `~/.ssh/opus55-render`，公钥经开机脚本放进实例 | `up` 没找到就生成 |
| ssh 配置 | `~/.ssh/opus55-render.config`，主机名是实例 ID，ProxyCommand 走 SSM | 每次运行都重写。也可以手动 `ssh -F ~/.ssh/opus55-render.config opus55-render` |
| 实例 | 最新的 Deep Learning Base OSS Nvidia Driver GPU AMI（Ubuntu 24.04，带 ffmpeg 6.1）。`--type` 里的类型按顺序、逐个可用区地试，容量不够就换下一个 | `up` |

`up` 的流程：
1. 开机。开机脚本先写好关机期限和 ssh 公钥，再装 Node（和本机同一版本）和 ffmpeg，装完留下 `/var/lib/cloud/opus55-ready`。
2. 等实例安顿好：SSM 在线；账号里的 SSM 关联跑完；开机脚本做完；没有待执行的重启。有些账号给所有实例挂了 `AWS-RunPatchBaseline` 这类关联，新实例一注册就打补丁，打完还会重启。所以安装部分写成 cloud-init 的 per-boot 脚本，被重启打断了，下次开机接着装。开机脚本失败时 `up` 直接报错，并给出看日志的命令。
3. rsync 同步代码（不带 `node_modules/` 和各片的 `out/`）。`package-lock.json` 变了，或者是第一次同步，就装一遍依赖、Chromium 和它要的系统库。

实例自己会到点关机：开机脚本把期限写进 `/etc/opus55-deadline`，cron 每 5 分钟看一次，过了期限就关机。关机行为设成了终止，所以忘了 `down` 也不会一直计费。这里不用 `shutdown -h +分钟`，因为补丁任务一重启，排好的关机就没了。云端命令中途断线（多半是补丁任务重启了实例）时，工具会等实例安顿好，再重跑一次。`render.mjs` 能断点续做，已出完的片子会跳过。

2026-09-29 用 g5.4xlarge（16 vCPU，NVIDIA A10G）出 03 的清单，12 条共 4320 帧，6 个 worker，用时 5.2 分钟。几点实测：
- 瓶颈在 CPU：出片时负载约 19，GPU 占用只有 5%，时间主要花在 PNG 编码和 x264 上。要更快就选 vCPU 更多的类型，比如 `--type g5.8xlarge`，再加大 `--workers`。
- 成片和 Mac 上出的不是逐字节相同（GPU 不同），但肉眼看不出差别：同一条片逐帧比，PSNR 37.8 dB，SSIM 0.97。
- 经 SSM 拉回成片约 0.8 MB/s，03 的 167 MB 用了 3.5 分钟。

用完记得 `down`。

## 清单

`<film>/manifest.json` 列出默认要出的片。每条 job 是一个网格，展开成各轴取值的全部组合。下面是 03 的清单，每款香型出三条，这也是各部片默认交付的三类片：16:9 15 秒中文、16:9 15 秒英文、1:1 6 秒中文双11：

```json
{ "jobs": [
  { "sku": ["*"], "ar": ["16x9"], "lang": ["zh"], "cut": [15], "promo": ["none"]   },
  { "sku": ["*"], "ar": ["16x9"], "lang": ["en"], "cut": [15], "promo": ["launch"] },
  { "sku": ["*"], "ar": ["1x1"],  "lang": ["zh"], "cut": [6],  "promo": ["1111"]   }
] }
```

- 可以写成片的轴，也可以写引擎轴 `ar`、`vo`。没写的轴取第一个值，`"*"` 取全部值。
- 值按字符串比较，`15` 和 `"15"` 都可以。
- 写了不存在的轴或值会报错（`manifest: unknown axis …`、`unknown sku: … (expected …)`），脚本以状态码 2 退出。
- 各 job 展开后按 `fileName(v)` 去重，所以几条网格可以重叠。

注意：命令行上写错的轴名（如 `--skus rose`）不会报错，只会被忽略。如果命令行上一条有效的轴都没有，脚本就回去读清单。出片前先用 `--dry` 看一眼要出哪些片。

## 输出

```
<film>/out/
├── <名>.mp4            成片；<名> = film.fileName(v)，如 wenjing_whitetea_15s_16x9_zh
├── <名>_cover.jpg      封面：剪辑的 cover 时刻，JPEG 质量 92
├── <名>.json           说明文件
├── <名>.mp4.part       正在编码的（做完就改名）
├── index.json          画廊读的索引
├── snap/ · sheet/      snap.mjs、sheet.mjs 的截图
└── audition/           vo.mjs --audition 的试听
```

说明文件（例）：

```json
{ "name": "demo_teal_3s_1x1_zh", "file": "demo_teal_3s_1x1_zh.mp4", "cover": "demo_teal_3s_1x1_zh_cover.jpg",
  "variant": { "color": "teal", "lang": "zh", "cut": 3, "ar": "1x1", "vo": "on" },
  "duration": 3, "width": 1080, "height": 1080, "fps": 30, "frames": 90, "bytes": 2871074,
  "audio": true, "lufs": -14, "tp": -2.7, "renderMs": 11996, "inputs": "9c41…（sha256，64 位）" }
```

没有音轨的片子，`audio` 为 `false`，`lufs`、`tp` 为 `null`。`index.json` 为 `{ film, group, axes, failed, videos }`：
- `group` 是分组用的轴（`sceneAxes[0]`）；
- `axes` 是全部轴及其取值；
- `failed` 是上一次运行失败的 `[{ name, error }]`；
- `videos` 是目录里所有 `.mp4` 还在的说明文件。

**断点续做**：
- `.mp4` 和 `.json` 都在，且 `.json` 里的 `inputs` 和这一次算出的一致，才算做完。重跑时跳过已做完的，打印 `skip (done)`。
- `inputs` 是出片输入的指纹（sha256）：成片目录里的全部文件（不含 `out/`、`test/`、`*.md`、`manifest.json` 和点文件），加上 `factory/engine/`、`factory/lib/`、`factory/render.mjs` 和 `--fps`。改了镜头、文案、配音或引擎，重跑时会全部重出，不会留着旧片。CDN 上的 three 与字体、Chromium、ffmpeg 的版本不在指纹里，升级它们之后要加 `--force`。
- 一条任务开始前，先删掉它上次留下的 `.part`、`.mp4`、`.json` 和封面。编码写到 `.part`，全部校验通过才改名，最后写 `.json`（先写临时文件再改名）。所以中断、重跑都不会把半截文件当成品。
- `index.json` 每次运行结束都重写。它收录目录里的全部成片，所以分几次出的片会累积在一起；`failed` 只记最近一次运行。
- 要从头来，删掉 `out/` 或加 `--force`。

## 声音

**混音**：
- `film.score(v, built)` 给出音符事件，由 `audio.js` 用 OfflineAudioContext 合成 48 kHz 立体声。
- 事件走两条母线：`music`（配乐，在配音下压低）和 `sfx`（音效、品牌动机，不压）。两条母线共用一个混响。
- 配音片段在正中，不进混响，混音增益 0.6。每句前 0.12 秒开始把 `music` 压低 9 dB，句末 0.3 秒回来。
- 结尾 0.3 秒淡出。同一变体混两遍，逐采样相同。
- 预览里的「声音」和出片用的是同一块混音。
- 没有 `score` 的成片出无声片（MP4 里没有音轨），这时 `voLines` 也不会混进去。

**响度**（`lib/ffmpeg.mjs`）：
1. 整段 WAV 先用 `volume` 增益到 −14 LUFS，经 `alimiter` 限幅在 −3 dBFS，再用 `volume` 补回限幅削掉的响度。只有增益和限幅，没有压缩，音乐的起伏不变。
2. 单独编成 AAC（192 kbps，48 kHz）。AAC 会抬高真峰值：超过 −1.5 dBTP 就把限幅再压低、重编，最多 4 遍。出片时这条音轨原样拷进 MP4。
3. 验收量的是成片：综合响度在 −14 ± 1 LUFS 以内，真峰值 ≤ −1 dBTP，不达标这条任务就失败。

**配音片段索引** `<film>/assets/vo/index.json`：

```json
{
  "whitetea_zh_15_hero": { "text": "一滴晨露，一片茶山。", "voice": "zm_yunxi", "speed": 1, "rate": 1, "dur": 1.557, "lufs": -20 }
}
```

- `text`、`voice`、`speed` 用来判断片段是否过期。
- `rate` 是实际语速：放不下时 vo.mjs 会提速重念，这时它会比 `speed` 大。
- `dur` 是片段秒数。

出片和预览时，页面按 `voLines(v)` 取片段，文件是 `assets/vo/<id>.mp3`，路径相对成片页面。以下几种情况都直接报错，不会悄悄少一句：
- 缺片段；
- 片段过期（文字、音色、语速和台词表对不上）；
- 片段比时段长。

报错信息里带着要运行的命令（`run: node factory/vo.mjs <film.id>`）。

## 成片约定

### 目录

```
NN-name/
├── index.html      字体 CSS、importmap、<main id="stage">、boot(film)
├── meta.js         export const META：Node 脚本（render.mjs、check.mjs）不加载 Three.js，直接读它
├── film.js         export default { ...META, … }：成片本体
├── manifest.json   默认清单（只用 --all 或命令行轴出片时可以没有）
├── story.js        （Level 3）给 story.mjs 的 STORY
├── stories/        story.mjs 写的文案（入库）
├── assets/vo/      vo.mjs 生成的配音（入库）
├── test/           *.test.mjs，npm test 会一起跑
├── out/            出片结果（不入库）
└── README.md
```

vo.mjs 会在 Node 里 `import` film.js，所以 film.js 的顶层不能碰 `window`、`document`。它可以 `import 'three'`（Node 里解析到 `node_modules/three`），也可以只用 `ctx.THREE`。

`index.html` 照 03 写即可：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5/700.css" />
<link rel="stylesheet" href="../factory/engine/player.css" />
<script type="importmap">
  { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
                 "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }
</script>
…
<main id="stage"></main>
<script type="module">
  import { boot } from '../factory/engine/app.js';
  import film from './film.js';
  boot(film);
</script>
```

**字体**：`fonts(v)` 里用到的每种字体、每个字重，都要在 `index.html` 里用 `@font-face` 声明（fontsource 的 CSS 就是）。引擎用 `document.fonts.load` 按确切的字符加载，并核对返回的字重：系统字体、没声明的字重都会报 `fonts not loaded: 400 Noto Sans SC`，页面不会用回退字体出片。

### `META`（meta.js）

| 字段 | 说明 |
|---|---|
| `id` | 必须等于目录名。vo.mjs 按它写 `assets/vo/`，报错提示里的命令也用它 |
| `axes` | 成片自己的轴 `{ 名: [值…] }`，第一个值是默认值。**必须有 `cut` 轴**，它的值就是 `cuts` 的键。`ar`（`9x16` · `1x1` · `16x9`）和 `vo`（`on` · `off`）是引擎轴，自动排在后面 |
| `sceneAxes` | 值一变就要重建场景（重新调 `setup`）的轴，如 03 的 `['sku']`；其余轴即时切换。第一条也是画廊的分组轴。可以是 `[]` |
| `cuts` | `{ [cut]: { shots, hits, cover } }`，见[剪辑表](#剪辑表) |
| `cutFor` | 可选。`v => { shots, hits, cover }`：剪辑表按变体取，比如每款产品一套分镜（镜头、命中点、封面都可以不同）。写了它，引擎、`render`、`check` 都按它取，`cuts` 只作默认；`check` 的确定性和音频按每套不同的剪辑表各测一个变体。`score`、`voLines` 收到的 `built` 就是这套 |
| `fileName(v)` | 输出文件名（不含扩展名）。批量按文件名去重，所以凡是会改变画面或声音的轴都要写进去；没有配音的成片不写 `vo`，`on`、`off` 就合成一条 |

### film.js 的默认导出

| 字段 | 必需 | 说明 |
|---|---|---|
| `...META` | ✓ | 上表各项 |
| `layouts` | ✓ | `layouts[ar][shot] = { anchor, size, maxW, zones }`，见[构图](#构图)。可以是 `{}` |
| `fonts(v)` | ✓ | `[{ family, weight, text }]`：这一变体要画的每种字体及其全部字符。没有字幕就返回 `[]` |
| `setup(ctx)` | ✓ | async。按 `ctx.variant` 搭场景：往 `ctx.scene` 里加灯光、网格，设背景和 `environment`；后面要用的对象放进 `ctx.subjects`；整片的后期设置放进 `ctx.postDefaults` |
| `reset(ctx)` | ✓ | 每求一个镜头之前调用：把镜头函数会改的东西（位置、旋转、可见性、材质参数…）复位 |
| `shots` | ✓ | `{ [shot]: (ctx, s) => ({ camera, text?, post? }) }`，剪辑表里用到的每个镜头名都要有 |
| `render(ctx, target)` | | 自己把场景画进 HDR 目标（要自己 `setRenderTarget(target)` 并清屏），如 03 的玻璃折射多遍渲染；不写就是 `renderer.render(scene, camera)` |
| `score(v, built)` | | `{ notes, reverb }`，见[配乐](#配乐)；不写就出无声片 |
| `voLines(v)` | | `[{ id, text, voice, speed, at, max }]`，见[配音台词](#配音台词) |
| `audition` | | `{ 语言: [音色…] }`，给 `vo.mjs --audition` 用 |

换场景时，引擎先调 `ctx.world?.dispose?.()`，再释放场景树里所有几何体、材质、贴图和 `scene.environment`，然后清空 `ctx.subjects`、`ctx.world`，最后调 `setup`。`setup` 之后、进入 `ready` 之前，引擎预编译着色器，并在每条剪辑的中点各画一帧。

### `ctx`

| 字段 | 说明 |
|---|---|
| `THREE` | three 模块 |
| `renderer` · `scene` · `camera` | 渲染器（打开阴影、PCFSoft），场景，唯一的相机（`PerspectiveCamera`，near 0.01、far 200，位置和视角每帧由取景决定） |
| `variant` | 当前变体 `{ 各轴: 值 }` |
| `ar` · `W` · `H` | 画面比例和画布像素。预览时画布是缩小的，所以镜头里一律用比例，不要用像素 |
| `post` | 后期链（`sceneRT` 是 HDR 场景目标，`render(ctx, target)` 就画进它） |
| `subjects` · `world` | 成片自己放东西的地方；换场景时清空（`world.dispose()` 会先被调用） |
| `postDefaults` | 整片 / 场景一级的后期设置，叠在引擎默认值之上、镜头的 `post` 之下 |
| `built` | 当前剪辑：`{ entries, duration, hits, cover }` |
| `mode` · `params` | `'live'` · `'sheet'` · `'render'`；页面网址的 `URLSearchParams` |
| `clips` | 保留字段，目前恒为 `null` |

### 剪辑表

```js
cuts: {
  15: {
    shots: [
      { shot: 'macro', dur: 2.25 },
      { shot: 'hero', dur: 3.0, from: 0.75, transition: { type: 'dissolve', dur: 0.3 } },
    ],
    hits: { land: 3.0 },  // 命名的时刻（成片秒），配乐和音效对齐用；引擎只是原样传给 score
    cover: 2.6,           // 封面取这一秒
  },
}
```

- 成片时长就是各条 `dur` 之和，转场不重叠、不改变总长。
- `from` 让镜头从自己时间线的中段切入：镜头拿到的本地时间从 `from` 开始。
- `transition` 属于切入的这一条，类型只有三种：
  - `cut`：默认，硬切；
  - `flash`：闪白，从 1 线性衰减到 0；
  - `dissolve`：叠化，上一镜头继续往后播，所以它的 `lt` 会超过自己的时长。
- 转场长度不能超过这一条的 `dur`。

镜头函数拿到的 `s`：

| 字段 | 说明 |
|---|---|
| `name` | 镜头名 |
| `lt` | 镜头本地秒：`from + (t − 这一条的开始)`。叠化时，上一镜头的 `lt` 会超过 `dur` |
| `dur` | 镜头全长 = `from` + 这一条的 `dur` |
| `u` | `lt / dur`，钳在 0–1 |
| `from` | 这一条的 `from`。字幕的入场时刻写成 `s.from + …`，从中段切入时字幕也照样完整入场 |
| `t` | 成片秒 |
| `row` | `layouts[ar][name]`，原样给出，成片可以在里面放自己的字段（03 放了 `align`） |

镜头函数只能依赖 `ctx.variant` 和 `s`：同样的输入，每次画出同样的一帧。每帧都会用到的代码里不许调用 `Math.random`、`Date.now`、`performance.now`；随机数用 `rng.js`（`rand(seed, i)`、`mulberry32`），粒子用 `particles.js` 的闭式漂移 `drift(seed, i, t, box, opts)`。镜头函数改过的状态由 `reset` 复位：
- 转场时，同一帧里要求两个镜头；
- 拖动时间轴时，求值的顺序是任意的。

check.mjs 的 `determinism` 项查的就是这一点。

#### 烘焙模拟（bake.js）

闭式写不出来的物理（珠子互相碰撞、落进杯里堆起来）不能每帧现算：拖动、倒放时结果会跟着求值顺序变。改在 `setup` 里按固定步长跑一遍，存成表，镜头每帧按 t 查表：

```js
import { bake, sampleRange } from '../factory/engine/bake.js';
// setup：init(rng) 给扁平的初始状态，step(state, dt, rng, t) 原地推进一步
ctx.pearls = bake({ seed: 7, dt: 1 / 240, t1: 2.5, stride: 1, init, step });
// 镜头里：取第 i 颗珠子的 [x, y, z]，不分配内存
sampleRange(ctx.pearls, s.lt, i * 6, 3, tmp);
```

- 表只由 `(seed, dt, t1, stride, init, step)` 决定，同样的参数烘两次逐字节相同。随机数只能用传进来的 `rng`（`rng.js` 的 `mulberry32(seed)`）。
- 存 `ceil(ceil(t1/dt) / stride) + 1` 帧，第 j 帧是时刻 `j·stride·dt`；取样在相邻两帧之间线性插值，t 钳在 `[0, t1]`，落在存储帧上时逐位等于存的值。
- `step` 拿到的是 `Float64Array`（双精度积分），表里存 `Float32Array`。
- 每帧取值用 `sampleInto(table, t, out)` 或 `sampleRange(table, t, offset, n, out)`，都不分配内存；`sampleBake(table, t)` 每次新分配，只在 setup 或测试里用。
- 表里的 `bakeMs` 是烘焙耗时。换 `sceneAxes` 里的轴会重跑 `setup`，`openFilm` 等页面最多 90 秒，所以一次烘焙控制在 1.5 秒以内（60 颗珠子、1/240 秒步长、2.5 秒约 60 ms）。
- 能写成闭式的（抛物线下落、阻尼弹簧、`drift`）就别烘：闭式没有存表和烘焙的开销。


#### 布料（cloth.js）

建在 `bake.js` 上：在 `setup` 里把一张方格布烘成表，镜头每帧按 t 取顶点，写进自己的 `BufferGeometry`。

```js
import { bakeCloth, clothAt, clothIndex } from '../factory/engine/cloth.js';
const scarf = bakeCloth({
  nx: 40, ny: 40, size: [0.7, 0.7], origin: [0, 1.2, 0], t1: 2.5, seed: 7,
  wind: (x, y, z, t, out, gust) => { out[0] = 2 + Math.sin(3 * t + 6 * gust[0]); out[1] = 0; out[2] = 0.5; },
  pins: [{ i: 0, j: 0, pos: t => [-0.35, 1.2, -0.35], until: 1.2 }],      // 一角先固定，1.2 秒松开
  colliders: [{ type: 'capsule', a: [-0.18, 1.0, 0], b: [0.18, 1.0, 0], r: 0.06 }, { type: 'ground', y: 0 }],
});
geo.setIndex(clothIndex(40, 40));
clothAt(scarf, s.lt, geo.attributes.position.array); geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
```

- 解法：每 1/1200 秒一个子步，积分（重力、风按法向投影、阻尼）→ 两遍结构 / 剪切 / 弯曲约束 → 限拉伸（结构边最多伸长 `strain`，默认 2%）→ 推出碰撞体 → 固定点归位。每 1/60 秒存一帧，帧间线性插值。
- 碰撞体的 `c` / `a` / `b` 可以是函数 `t => [x, y, z]`（会动的东西）；`pins` 的 `pos(t)` 也是脚本，可以提起、扇动，`until` 之后松开。
- 不做布的自碰撞：垂下来的褶子可能互相穿过，靠厚度（`thickness`）和落点安排避开。
- 40 × 40、2.5 秒约 1.1 秒烘完（`table.bakeMs`）；`maxStretch(cloth, P)` 给测试和自检看拉伸。

### 构图

`layouts[ar][shot]` 的各字段，坐标都是画面比例，原点在左上角，y 向下：

| 字段 | 说明 |
|---|---|
| `anchor` | `[x, y]`，主体投影框的中心落在这里 |
| `size` | 主体投影框的高度占画面高度的比例 |
| `maxW` | 主体投影框宽度的上限（占画面宽度），默认 0.9 |
| `zones` | `{ 区名: [x, y, w, h] }`：字幕区。字幕图层按区名放进去 |

9:16 画面的上 7%、下 18% 和右侧中段会被抖音、淘宝的界面盖住（`variant.js` 的 `UNSAFE`）。主体和字幕都要躲开这些区域，再留出 4% 边距，用 `?safe` 检查。1:1 和 16:9 只有边距要求。

镜头返回的 `camera` 是取景意图，不是相机数字：

| 意图 | 字段 | 说明 |
|---|---|---|
| fit（默认） | `{ box, dir, up?, fov, anchor?, size?, scale?, maxW? }` | `box` 是主体的 `THREE.Box3`，`dir` 是从主体中心指向相机的方向。引擎二分求相机距离，使投影框的高度等于 `size × scale`、宽度不超过 `maxW`，再用 `setViewOffset` 把主体平移到 `anchor`，不转动相机，所以各比例下透视相同。`anchor`、`size`、`maxW` 不写时取构图行里的值 |
| free | `{ type: 'free', position, target, fov, up?, fovAxis?, offset? }` | 直接给机位。`fovAxis: 'short'` 让竖屏下 `fov` 指的是水平视角；`offset` 是 `[x, y]` 的 view offset（画面比例） |
| blend | `{ type: 'blend', a, b, k }` | 两个意图各自求解后按 `k` 插值，比如从 fit 推到 free |

### 字幕图层

镜头返回的 `text` 是图层数组：

| 字段 | 说明 |
|---|---|
| `id` | 图层名。溢出时报成 `<镜头>.<id>` |
| `zone` | 构图行 `zones` 里的区名；没有这个区会报错 |
| `text` · `lang` | 文字，可以用 `\n` 换行。`lang: 'en'` 按词折行，其他值都按字折行，并遵守避头尾 |
| `font` | `{ family, weight, style?, fallback? }` |
| `size` · `min` | 字号（画面短边的比例），放不下时逐步缩小，最小到 `min`。`min` 不会低于引擎的最小字号（9:16、1:1 为 3.5%，16:9 为 3.0%） |
| `lineHeight` · `maxLines` · `tracking` | 行高（默认 1.25）、最多几行、字距（em） |
| `align` · `valign` | `left` / `center` / `right`；`top` / `middle` / `bottom` |
| `color` · `alpha` · `shadow` | 颜色、不透明度，阴影 `{ color, blur }`（`blur` 是字号的倍数） |
| `in` · `out` | 镜头本地秒 `[起, 止]`：逐行上浮入场、淡出 |
| `box` | 底色块 `{ fill, color, pad, radius }`：`color` 是块上文字的颜色，`pad`（默认 0.35）、`radius` 是字号的倍数。排版时字宽加上两边的 `pad` 一起放进区宽；左 / 右对齐时，块的边贴着区的边 |
| `leader` | 引线 `{ world: [x, y, z], color }`：从这个世界坐标点（按这一镜头的相机投影）画向文字 |
| `pop` · `strike` | 入场时弹一下；删除线（如原价） |

缩到最小字号还放不下的，就算溢出。预览和联系表里溢出的区画红框；出片时溢出，这条任务直接失败。

### 后期

镜头返回的 `post` 叠在 `ctx.postDefaults` 之上，`ctx.postDefaults` 又叠在引擎默认值之上。`bloom` 按字段合并，其余字段整项覆盖：

| 字段 | 默认 | 说明 |
|---|---|---|
| `exposure` | 1 | 曝光 |
| `focus` · `aperture` · `maxBlur` | `'target'` · 0 · 0.012 | 对焦距离（米；`'target'` 是取景解出的注视点距离）、景深强度（0 关）、最大弥散圆（短边比例） |
| `bloom` | `{ strength: 0.22, radius: 0.45, threshold: 0.85 }` | 泛光 |
| `lift` · `gamma` · `gain` · `saturation` | `[0,0,0]` · `[1,1,1]` · `[1,1,1]` · 1 | 调色 |
| `vignette` · `grain` | 0.22 · 0.03 | 暗角、颗粒 |
| `flashColor` | `[1, 0.98, 0.94]` | 闪白转场的颜色 |

色调映射是 AgX。字幕在后期之后才叠上去，不受景深、颗粒影响。

### 分层折射（engine/refract.js）

透明容器装液体（香水瓶、奶茶杯）时用。`createRefraction(ctx, o)` 把容器壁和液体的材质换成分层折射着色器，加上三张 RGB 焦散网格和一个只投影的替身，返回 `{ render(target), uniforms, caustics }`；成片的 `render(ctx, target)` 每帧调 `render(target)`。它往同一张 HDR 目标里依次画：第 0 层（世界）→ `LAYER.contents`（可选，液体里的东西，比如冰块）→ `LAYER.liquid` → `LAYER.glass` → `LAYER.over`（挡在容器前面的半透明东西，成片自己把网格放进这一层）。每一遍都采样前面几遍解析好的颜色和深度。光在壁和液体里走的路程按形状解析求出，算的东西有：比尔–朗伯吸收、出口处的菲涅耳分光（全反射时连续过渡）、玻璃三色色散、按粗糙度的磨砂模糊，以及按走过的面分路、亮度取“出发面积 / 落地面积”的地面焦散。

形状描述 `shape` 是容器本地坐标（原点在底面中心，y 向上，米）里的三个凸实体 `outer`（外形）、`cavity`（内腔）、`liquid`（液体）：

| `kind` | 每个实体 | 构造函数 |
|---|---|---|
| `'prism'` 凸棱柱 | `{ planes: [[nx, nz, d], …], y: [y0, y1] }`，内部满足 nx·x + nz·z ≤ d；N 个法线按角度 0, 2π/N, … 均匀排开，三个实体 N 相同 | `prismShape({ outer, cavity, liquid })` |
| `'frustum'` 竖轴截锥 | `{ r: [y0 处半径, y1 处半径], y: [y0, y1] }`，两个半径都 > 0 | `frustumShape({ rBottom, rTop, height, wall, base, fill, gap, open })`：壁厚垂直于斜壁量，内腔默认开口到杯口 |

液面高度 = `liquid.y[1]`。`enter(shape, solid, p, d)` / `exit(shape, solid, p, d)` / `boundsOf(shape)` 是着色器求交的 JS 参考实现，和 GLSL 一个算法，可以在 Node 里测。

`o` 必填：`shape`；`optics`（`glassIor`、`liquidIor`、`glassAbsorb[3]`、`dispersion`、`frostBlur`、`frostDiffuse`、`causticGrid`、`causticGain`、`interfaces`、`lowLod`，缺一个就报错）；`root`（容器的根，焦散和替身挂在它下面）；`glass`（壁的网格）；`liquid`（液体网格或组）；`liquidAbsorb[3]`（1/米）。可选：`name`（程序缓存键前缀）、`liquidMaterial`、`scatter`（乳浊液体的散射系数，1/米，走得越远越接近液体自己被照亮的颜色）、`contents: { object, absorb, thickness, ior }`、`ripple` + `age()`（焦散里的液面涟漪）、`neck: { wall }`（外形顶面以上当薄壁管）、`occluder: { y, r }`（焦散里挡光的竖直圆柱）、`aim`（焦散网格对准的盒子，默认外形包围盒）。`refractGLSL(o)` 只生成源码，测试用。完整的接法见 `03-perfume/js/glass.js`（八角瓶 + 瓶颈 + 瓶盖挡光 + 涟漪）。

局限：只有凸实体，没有凹形、手柄、杯盖；液面在焦散里是平面加涟漪，折射遍里液面形状由液体网格自己给；`contents` 当作厚 `thickness` 的平板，不追冰块内部的光路，冰块之间也不互相折射；背后的画面是屏幕空间取的，光路出了画面就取糊开的世界；每多一层就多画一遍，焦散是 3 × `causticGrid`² 个顶点。

### 配乐

`score(v, built)` 返回 `{ notes, reverb: { decay, music, sfx } }`：
- `reverb` 里，`decay` 是混响秒数（默认 2），`music`、`sfx` 是两条母线送进混响的量。
- 每个音符是 `{ t, voice, f, d, v, bus?, pan?, p? }`：
  - `t`、`d` 分别是开始秒和时值；
  - `f` 是频率，可以用 `mtof(midi)` 算；
  - `v` 是力度，`pan` 是声像；
  - `bus` 取 `'music'`（默认）或 `'sfx'`；
  - `p` 是音色参数。

音色（`audio.js` 的 `VOICES`）：

| 音色 | 用途 · 参数 |
|---|---|
| `pluck` | 拨弦（古琴、竖琴、卡林巴）· `t60` 余音、`bright` 亮度 |
| `pad` | 铺底 · `a` 起音、`r` 释放、`cut` 截止频率（f 的倍数）、`air` 气声 |
| `flute` | 气声长笛 · `a`、`r`、`breath` |
| `bell` | 钟、钢片琴、玻璃 · `ratios` 分音比、`bright` |
| `plink` | 水滴 · `up` 上滑的倍数 |
| `noise` | 风、雾、喷雾、转场呼声 · `type`、`q`、`sweep`、`a`、`r`、`wander` |
| `click` | 咔哒声 |

`built.hits` 是剪辑表里的命名时刻，配乐按它对齐；`timeline.js` 的 `shotAt(built, name)` 可以取某个镜头在这一剪辑里的起止。

### 配音台词

`voLines(v)` 返回这一变体要念的句子：`[{ id, text, voice, speed, at, max }]`：
- `at` 是句子在成片里开始的秒数，`max` 是时段的最长秒数；
- `voice` 是 Kokoro 音色，如 `zm_yunxi`、`bf_emma`；`speed` 是语速。

写台词表时注意以下几点：
- `v.vo === 'off'` 时返回 `[]`。引擎只提供这条轴，关掉配音要靠成片自己。
- 同一个 `id` 在所有变体里文字相同。
- 台词不能随 `ar` 变：vo.mjs 只按 9x16 收集台词。
- 数字写成汉字或英文单词，Kokoro 直接读阿拉伯数字不稳定。用 `engine/say.js`：`sayNum`（0–99 999）、`sayYear`（二零二六 · twenty twenty-six）、`sayMonth`（十一月 · November）。
- 每句要在成片最后 0.3 秒的淡出之前念完。

### 文案（story.js）

Level 3 的成片把「写什么」交给模型，分工如下：
- 数字和统计都由代码从数据算好；
- 模型只写字，数字留成 `{占位符}`，由代码填进去；
- 模型写的字里不许自己带数字，所以它编不出统计。

出片时只读已存的 `stories/<id>.json`，不调用模型，每一帧仍只由（变体, t）决定。

`story.js` 导出 `STORY`：

| 字段 | 说明 |
|---|---|
| `axis` · `ids` | 一份文案对应这条轴的一个值，如 04 的 `user`；`ids` 是全部值 |
| `facts(id)` | 代码算好的统计。它的指纹 `storyKey(facts)` 存进文案，数据一变，文案就算过期 |
| `schema` | 模型要填的字段（JSON Schema），也就是 `write_story` 的输入 |
| `system` · `prompt(id)` | 系统提示；给这一个的提示词，写明统计、每个字段的占位符和字数预算 |
| `toolDescription` | 可选，`write_story` 的说明 |
| `check(id, story)` | 返回错误描述的数组，空数组表示通过。错误会原样发回给模型，所以要写成它能照着改的话，如 `captions.top.en is 3 characters too wide for 9x16` |

写 `check` 用的纯函数在 `engine/story.js`：
- `slotErrors(label, tpl, { required, optional })`：`required` 里的占位符每个正好一次，`optional` 里的最多一次，别的都不许有。`fill(tpl, values)` 填值，缺值就报错。
- `writtenNumbers(s, lang)`：找出模型自己写的数字，包括阿拉伯数字、英文数词和中文数字。中文的「一」不查，一起、每一次这样的词太常见。
- `speechSec(s, lang)`：估一句配音要念多久。按中文每秒 4.8 个字、英文每秒 4 个音节算，句中每个标点加 0.15 秒。比 Kokoro 实测略慢，所以只会高估。真正的时长还是由 vo.mjs 量。
- 字宽用 `text.js` 的 `approxMeasure`，和字幕测试一样。

成片在 `setup` 里读文案，缺了或过期了就报错，并给出要跑的命令。成片测试会对入库的文案都跑一遍 `check`。还没调用模型时，可以先手写占位稿，把 `model` 写成 `"draft"`：页面照常能看，`story.mjs` 不带 `--force` 也会替换它。

### 测试

成片目录下的 `test/*.test.mjs` 会被 `npm test` 一起跑，只用 `node:test` 和 `node:assert/strict`。纯数据（meta.js、文案、构图）可以直接在 Node 里测。`text.js` 的 `approxMeasure` 是一个只会偏宽的量字模型，用它测「每段文字 × 每个区 × 每种比例 × 每种语言都放得下」：在 Node 里通过，浏览器里用真实字体也放得下。

## 新片起步

下面是一部最小的成片 `99-demo`：一个旋转的环结、一行标题，两个镜头，共 3 秒；两条成片轴 `color`、`lang`，外加必需的 `cut`。上面各节的命令输出都来自它。

`99-demo/meta.js`：

```js
export const META = {
  id: '99-demo',
  axes: { color: ['teal', 'coral'], lang: ['zh', 'en'], cut: [3] },
  sceneAxes: ['color'],
  cuts: {
    3: {
      shots: [{ shot: 'turn', dur: 1.5 }, { shot: 'card', dur: 1.5, transition: { type: 'dissolve', dur: 0.3 } }],
      hits: { card: 1.5 }, cover: 2.4,
    },
  },
  fileName: v => `demo_${v.color}_${v.cut}s_${v.ar}_${v.lang}`,
};
```

`99-demo/film.js`：

```js
import { META } from './meta.js';

const COLOR = { teal: '#2f9fb2', coral: '#e8735a' };
const TITLE = { zh: '一个模板，批量出片', en: 'One template, every format' };
const FONT = { family: 'Noto Sans SC', weight: 700 };

const zones = (title, sub) => ({ zones: { title, sub } });
const LAYOUTS = {
  '9x16': { turn: { anchor: [0.45, 0.36], size: 0.34, ...zones([0.08, 0.62, 0.74, 0.08], [0.08, 0.7, 0.74, 0.05]) }, card: { anchor: [0.45, 0.3], size: 0.24, ...zones([0.08, 0.5, 0.74, 0.08], [0.08, 0.58, 0.74, 0.05]) } },
  '1x1': { turn: { anchor: [0.5, 0.4], size: 0.5, ...zones([0.08, 0.76, 0.84, 0.1], [0.08, 0.86, 0.84, 0.07]) }, card: { anchor: [0.5, 0.34], size: 0.36, ...zones([0.08, 0.62, 0.84, 0.1], [0.08, 0.72, 0.84, 0.07]) } },
  '16x9': { turn: { anchor: [0.68, 0.5], size: 0.6, maxW: 0.5, ...zones([0.07, 0.4, 0.43, 0.14], [0.07, 0.54, 0.43, 0.08]) }, card: { anchor: [0.7, 0.5], size: 0.45, maxW: 0.5, ...zones([0.07, 0.4, 0.43, 0.14], [0.07, 0.54, 0.43, 0.08]) } },
};
const layers = (v, s) => [
  { id: 'title', zone: 'title', text: TITLE[v.lang], lang: v.lang, font: FONT, size: 0.06, align: 'center', valign: 'middle', color: '#f4f1e8', in: [s.from + 0.2, s.from + 0.7] },
  ...(s.name === 'card' ? [{ id: 'sub', zone: 'sub', text: `99-demo · ${v.color}`, lang: 'en', font: FONT, size: 0.036, align: 'center', color: '#b8c4c8', in: [0.3, 0.8] }] : []),
];

export default {
  ...META,
  layouts: LAYOUTS,
  fonts: v => [{ ...FONT, text: `${TITLE[v.lang]}99-demo · ${v.color}` }],
  async setup(ctx) {
    const { THREE, scene } = ctx;
    scene.background = new THREE.Color('#14181c');
    const key = new THREE.DirectionalLight('#ffffff', 2.5);
    key.position.set(2, 3, 2);
    scene.add(key, new THREE.HemisphereLight('#b0c8ff', '#202020', 0.8));
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.1, 160, 24), new THREE.MeshStandardMaterial({ color: COLOR[ctx.variant.color], roughness: 0.35, metalness: 0.2 }));
    knot.position.y = 0.45;
    scene.add(knot);
    ctx.subjects.knot = knot;
    ctx.subjects.box = new THREE.Box3().setFromObject(knot);
    ctx.postDefaults = { vignette: 0.3 };
  },
  reset(ctx) { ctx.subjects.knot.rotation.set(0, 0, 0); },
  shots: {
    turn(ctx, s) {
      ctx.subjects.knot.rotation.y = s.lt * 1.2;
      return { camera: { box: ctx.subjects.box, dir: [0, 0.25, 1], fov: 30 }, text: layers(ctx.variant, s) };
    },
    card(ctx, s) {
      ctx.subjects.knot.rotation.y = 1.8 + s.lt * 0.6;
      return { camera: { box: ctx.subjects.box, dir: [0.4, 0.3, 1], fov: 30 }, text: layers(ctx.variant, s), post: { exposure: 1.1 } };
    },
  },
  score: (v, built) => ({
    notes: [
      { t: 0, voice: 'pad', f: 220, d: 3, v: 0.8 },
      { t: 0, voice: 'bell', f: 880, d: 1.2, v: 0.6, bus: 'sfx' },
      { t: built.hits.card, voice: 'bell', f: 1320, d: 1.2, v: 0.6, bus: 'sfx' },
    ],
    reverb: { decay: 1.5, music: 0.3, sfx: 0.2 },
  }),
};
```

`99-demo/manifest.json`：

```json
{ "jobs": [
  { "color": ["*"], "ar": ["1x1"], "lang": ["zh"], "cut": [3] }
] }
```

`99-demo/index.html` 照[目录](#目录-1)一节的模板写，字体只要 `noto-sans-sc@5/700.css`。

然后依次执行：

```bash
npm run serve                                   # 打开 http://127.0.0.1:8765/99-demo/ 预览，试各个下拉框
node factory/check.mjs 99-demo                  # 七项全过
node factory/sheet.mjs 99-demo --safe           # 三种比例 × 两种语言，看构图和安全区
node factory/snap.mjs 99-demo --t 0.8,2.4 --ar 9x16 --lang en --color coral
node factory/vo.mjs 99-demo                     # 没有 voLines：nothing to do
node factory/render.mjs 99-demo                 # 按清单出 2 条
# 打开 http://127.0.0.1:8765/factory/gallery.html?film=99-demo
```

真正的成片按这个顺序来：
1. 先写分镜表（镜头、时长、命中点、文案），确认后再动手。
2. 先搭好目录和数据，再一个镜头一个镜头地做。每做完一个镜头，就用 `?sheet` 或 `sheet.mjs` 在每种比例、每种语言下检查一遍。
3. 写清单、生成配音、出片，最后在画廊里审片。

`new-film` 技能就是按这个流程写的。

### 常见报错

| 报错 | 原因 |
|---|---|
| `page never created window.__app` 下面跟着 `page: …` | 页面启动时抛错。真正的原因在 `page:` 那一行：这个标题对 `__app.ready` 失败也会出现 |
| `fonts not loaded: 700 Inter` | `fonts(v)` 里的字体或字重没在 index.html 里声明 |
| `cut: empty edit list` | `axes` 里没有 `cut` 轴，或者它的值在 `cuts` 里找不到 |
| `manifest: unknown axis cut` | 清单里写了成片没有的轴 |
| `unknown color: pink (expected teal \| coral)` | 网址、清单或命令行里的值不在轴里 |
| `text layer title: no zone title` | 图层的 `zone` 在这一比例、这一镜头的构图行里没有 |
| `voice-over clip missing: …` · `voice-over clip out of date: …` | 新加或改过台词、音色、语速，还没重新生成片段：按提示运行 `node factory/vo.mjs <film>` |
| `loudness … LUFS ≠ -14 ± 1` · `true peak … dBTP > −1` | 成片响度不达标。重编 4 遍后真峰值还超，多半是高频很重的瞬态被 AAC 推高了：把这类音色做柔一些，或在 `score` 里调低它 |
| `software WebGL (…); refusing to render` | Chromium 没拿到 GPU：不要在没有显示环境的远程机器上跑，或者检查启动参数 |

## 局限

- 画面比例固定为 `9x16`、`1x1`、`16x9` 三种，尺寸固定，安全区只为 9:16 定义了平台界面遮挡区。成片不能去掉某个比例，只能在清单里不出它。
- 英文按词折行只认 `lang: 'en'`，其他语言（包括别的拉丁字母语言）都按字折行。
- `vo` 轴总是在：没有配音的成片，预览页和画廊里也会有 `vo` 选项。
- 转场只有硬切、闪白、叠化三种；一部片只有一台相机。
- 声音由成片的 `score` 驱动：只有配音、没有配乐的片子，目前也要写一个 `score`（`notes` 可以是空数组）。但整段完全静音的混音（如 `vo: off` 又没有音符）会在响度一步报 `… is silent` 失败，这类片子清单里只出 `vo: on`，或者垫一层很轻的底噪。
- 画廊只读 `<film>/out/`，`render.mjs --out` 放到别处的片子画廊里看不到。
