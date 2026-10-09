# 08 · 有集次日达：一个包裹的旅程

有集「次日达」的物流广告：三件商品各讲一条送货故事，每条都有两种做法。一种是 Opus 写代码、引擎实时渲染的**代码版**，另一种是 Opus 写提示词、LTX-2.5 生成实拍画面的 **AI 版**。分镜见 [`docs/specs/2026-10-01-08-parcel-journey-storyboard-v2.md`](../docs/specs/2026-10-01-08-parcel-journey-storyboard-v2.md)（v2，已批）。

> **虚构品牌**：片中的「有集 Youji」是虚构的购物 App，沿用自 04 年度购物报告；商品、价格也取自 04 的目录（`04-year-review/catalog.js`，只读引用）。
> 片中出现的所有品牌、商品、价格均为演示用途，并非真实。

## 三条故事线

| 商品 | 故事 | 节奏 | 镜头 |
|---|---|---|---|
| 营地灯 `lantern` | 一个包裹的旅程：从手机下单一路跟到门口，贴地连续运镜 | 120 bpm | 手机下单 → 货到人仓库的 AGV 群 → 自动开箱、封箱、贴面单 → 交叉带分拣 → 月台装车（天色转黎明）→ 最后一公里 → 门口交接 |
| 电竞耳机 `headset` | 赛前送达：深夜排位耳机断音输了，明早决赛，城市前置仓连夜送上楼。霓虹夜城 + 游戏 HUD | 128 bpm 快切 | DEFEAT 断音 → 下单倒计时 → 立体仓储机器人提料箱 → 夜城路线地图 → 雨后街道溅水 → 电梯 1→23 层送达 → 戴上新耳机 VICTORY |
| 瑰夏咖啡豆 `beans` | 今天烘的豆，明天在你杯里：讲新鲜。暖调、微距、蒸汽和晨光 | 96 bpm 慢推叠化 | 滚筒烘豆 → 冷却盘倾泻 → 装袋盖「今天烘焙」章 → 夜间干线 → 老街清晨递到门口 → 家里手冲注水 |

三条线共用片尾卡、价签和有集三音动机，听起来是同一个品牌。配音是 Kokoro 的有集品牌声音（中文 `zm_yunjian`、英文 `am_michael`）。

## 代码版和 AI 版

| 变体 | 画面 | 说明 |
|---|---|---|
| `lantern` / `headset` / `beans` | 代码版：Three.js 程序建模 + 程序纹理 + 环境反射，引擎实时渲染 | 目标是质感好的商业 CG，不是照片级 |
| `lantern-ai` / `beans-ai` | 整片 AI：每个镜头的底图都是 LTX-2.5 片段 | 剪辑表、字幕、配音、配乐、价格全部沿用代码版，只换底图 |
| `headset-ai` | 逐镜 AI：只有 `victory` 一个镜头换成 LTX-2.5 实拍的玩家，其余六镜仍是代码渲染 | 代码做的玩家偏 Q 版，写实人物交给视频模型；屏幕上的「VICTORY」由引擎叠加，和开头的 DEFEAT 呼应 |

AI 版的分工：视频模型只出**画面**，画面里不要任何文字；字幕、片尾卡、价签、HUD、配音和配乐都由引擎叠在实拍片段上，所以文案、价格和品牌永远准确，换语言、换活动也不用重新生成。片尾镜头的提示词会让主体偏到一侧，给片尾卡留出空位。

模型选型：咖啡豆先做了 LTX-2.5 和 Wan 2.2 的对比（[`ai/report/REPORT.md`](ai/report/REPORT.md)）。LTX-2.5 蒸馏版 + FP8 在 L40S 上显存约 25 GB，画面最稳；Wan 2.2 在 L4 上解码 OOM。三条 AI 线都用 LTX-2.5。

## 交付

每个变体 3 条：16:9 15 秒中文、16:9 15 秒英文首发（`launch`）、1:1 6 秒中文双11（`1111`），文件名 `youji-parcel_<item>_<cut>_<ar>_<lang>[_<promo>].mp4`。

| 变体 | 条数 |
|---|---|
| `lantern`（另加一条 16:9 6 秒中文） | 4 |
| `beans` / `headset` | 3 + 3 |
| `lantern-ai` / `beans-ai` / `headset-ai` | 3 + 3 + 3 |
| 合计 | **19** |

成片和封面在 `out/`（gitignore，不入库）；画廊读 `out/index.json`。LTX 原始片段已清理，重新渲染 AI 版前要先在 GPU 上重新生成。

## 运行

```bash
npm run serve
# 预览：http://127.0.0.1:8765/08-parcel-journey/?ar=16x9&item=headset
# 画廊：http://127.0.0.1:8765/factory/gallery.html?film=08-parcel-journey
```

- 轴：`item`（`lantern` / `headset` / `beans` / `lantern-ai` / `headset-ai` / `beans-ai`）· `lang`（zh / en）· `cut`（15 / 6）· `promo`（none / 1111 / launch），外加引擎的 `ar`、`vo`。
- 出片（本机慢就上 AWS GPU，见 [factory/README.md](../factory/README.md#cloudmjs云端出片)）：

```bash
node factory/render.mjs 08-parcel-journey --dry           # 先看清单
node factory/cloud.mjs up --hours 2
node factory/cloud.mjs run node factory/check.mjs 08-parcel-journey
node factory/cloud.mjs render 08-parcel-journey --workers 1   # 单进程，避免黑帧
node factory/cloud.mjs down
```

- AI 片段生成：提示词在 `ai/lantern-shots.json`、`ai/headset-shots.json`、`ai/beans-shots.json`；LTX 环境和生成脚本在 `ai/ltx/` 和 `ai/beans-gen.py`（模型只加载一次，连续生成；用 g6e.2xlarge 及以上，内存放得下 42 GB 的 transformer）。生成脚本要用 `setsid nohup` 脱离 agent 运行，并定时把片段拉回本地。

## 实现

| 部分 | 做法 |
|---|---|
| 目录 | 营地灯在 `js/`（`world.js`、`shots.js`、`score.js`、`crowd.js`），耳机和咖啡豆各在 `stories/headset/`、`stories/beans/`（各自的 `meta.js` 剪辑表、`world.js`、`shots.js`、`score.js`）。`film.cutFor(v)` 按 `item` 取剪辑表；`items.js` 里 AI 变体用 `base` 指回代码版，「只看故事」的数据都沿用基准商品 |
| 营地灯 AGV 群 | `js/crowd.js`：16×10 网格、约 48 台 AGV，带时空预约表的协同 A*（按优先级逐台规划，同一时刻不占同一格、不对穿同一条边）。目标那台在成片 4.0 s 停到拣货台，规划不出就换种子重试；结果存成 `Int16Array`，同一种子逐字节相同 |
| 耳机 | 立体仓储网格 + 顶部机器人闭式轨道调度；夜城地图用实例化楼块 + 发光道路线；雨后积水用平面镜面反射 + 法线扰动；HUD 用引擎的 2D 文字层 + 矢量图形 |
| 咖啡豆 | 烘豆机滚筒和冷却盘倾泻用 `bake.js` 烘一次（约 300 颗豆，颜色从青绿插值到深棕）；蒸汽和烟用引擎粒子 |
| AI 底图 | `js/world-ai.js` / `js/world-headset-ai.js` 把 LTX 片段逐帧当底图贴进场景，`js/shots-ai.js` 给 AI 版改字幕和片尾卡的位置 |
| 确定性 | 所有动作都是（变体, t）的闭式函数或烘好的表，`reset(ctx)` 复位；`check.mjs` 用正序 / 倒序渲染同一帧比对 |

## 已知小问题（不修）

- 耳机 AI 版 16:9：片尾卡出场时会盖住玩家举起的拳头。
- 耳机代码版 1:1：电梯镜头里「23」的上沿被裁掉一点。
