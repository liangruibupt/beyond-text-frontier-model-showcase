# 09 · 星潮 STARTIDE —— 双11 零点大屏视频工厂

虚构大促品牌「**星潮 STARTIDE**」的双11 零点作战大屏。倒计时归零的那一刻，全国订单像星座一样依次点亮，海量弧线从星座飞向少数几个仓库汇聚点，GMV 计数器一路缓动狂飙，里程碑逐个爆屏。方法一 code-authored：画面是 [factory 引擎](../factory/README.md) 上的 Three.js 实例化 motion graphics，每一帧只由（变体, t）确定，像素级可控、可批量出多变体。

品牌、GMV / 订单数字全是**固定种子算出来的虚构数据**，不代表任何真实平台。

## 「订单星座」布局：不画地理边界

用户 2026-09-30 拍板：**不画任何地理边界、不用国家标准地图**。原因是涉及中国领土的地图（边界画法）属「问题地图」，叠加 / 缩放 / 裁剪 / 改色都算修改、须重新送审（只法人可申、约 20 工作日）。所以城市用一组**抽象发光散点**代表，程序布局成「星座」而非地图——观众读到的是「全国海量订单奔向仓库」的峰值叙事。相关布局引擎是 [`factory/engine/constellation.js`](../factory/engine/constellation.js)（确定性纯函数，随机只来自 `rng.js`，带 13 条测试）。

## 四款主题

四款是「四套不同的大屏视角」，星座分布、配色、仓库布局、里程碑文案、弧线方向各不同（`sceneAxes:['theme']`）：

| 主题 | 星座布局 | 配色 | 仓库 | 里程碑 / 弧线 |
|---|---|---|---|---|
| 全国总览 `national`（默认） | `spread` 均匀铺满全屏 | 冷蓝 | 8 个汇聚点（最远点采样） | 十亿 GMV |
| 核心都市圈 `megacity` | `clusters` 按**北上广深真实经纬度**聚成四城团簇 | 品红 | 四城即仓库 | 单城破亿 |
| 全球跨境 `crossborder` | `worldmap` **无国界点阵世界地图**（大陆掩膜拒绝采样，不画任何国界 / 海岸线） | 青绿 | 7 个 | 六十八国同时下单 |
| 物流履约 `logistics` | `spread` + 弧线**反向**（仓库→星座，代表发货） | 琥珀金 | 8 个 | 每分钟两百四十万单已发出 |

## 做法

| | |
|---|---|
| **星座与仓库** | [`constellation.js`](../factory/engine/constellation.js) 的 `layoutNodes`（spread / clusters / rings / worldmap 四种模式）+ `layoutHubs`（贪心最远点采样）。megacity 用 `cityCenters` 把北上广深经纬度映射到画面；crossborder 用 `inLandMask` 从七大洲椭圆块拒绝采样，`mapScale` 放大点阵铺满画面 |
| **订单弧线** | `arcSchedule` 为约四千条弧线分配（起点, 终点, 起飞时刻, 时长），固定种子 → 相同调度、可按 t 乱序取样（配合 scrub 与叠化）；`arcPath` 二次贝塞尔。每帧 `activeArcs(t)` 取飞行中的弧线，用 Three.js `InstancedMesh` 画出**彗头（明亮大点）+ 拖尾折线**；密度随 `arcs` 镜头推进分批升到峰值 |
| **节点点亮波纹** | 归零瞬间按「与最近仓库的距离」做波纹式依次点亮；文字镜头把背景节点整体压暗（`dim`）让计数器和里程碑读得清 |
| **GMV 计数器** | `gmvAt(t)` 是 t 的纯函数缓动（`easeOut`），等宽数字避免抖动；绝不逐帧随机跳字 |
| **配乐与配音** | `js/score.js` 零点氛围：低音脉冲渐强 → 归零 whoosh + 和弦铺底 → 主旋律铃 → 计数器滴答 → 里程碑重音 → 片尾三音动机。配音用 Kokoro，中文 `zf_xiaoxiao`、英文 `bf_emma`，数字一律念成字；画面写 "Double 11"，配音念 "Double Eleven" |

## 交付

本次按用户缩范围只出 **2 条**（主题取默认 `national`），`film.js` 的轴定义仍保留完整四款主题 × 中英 × 15/6 秒 × 三种活动：

| | 文件 |
|---|---|
| 16:9 · 15 秒 · 中文 · 标语片尾 | `startide_national_15s_16x9_zh` |
| 1:1 · 6 秒 · 英文 · 新品片尾 | `startide_national_6s_1x1_en_launch` |

成片与封面在 `out/`（gitignore，另备份到 `s3://cdh-ingest-demo/showcase/09-singles-day/`）；画廊读 `out/index.json`。

## 运行

```bash
npm run serve
# 预览： http://127.0.0.1:8765/09-singles-day/?ar=16x9
# 画廊： http://127.0.0.1:8765/factory/gallery.html?film=09-singles-day
```

出片（本机慢则上 AWS GPU）：

```bash
node factory/render.mjs 09-singles-day --dry        # 先看清单
node factory/cloud.mjs up --hours 2
node factory/cloud.mjs run node factory/check.mjs 09-singles-day
node factory/cloud.mjs render 09-singles-day
node factory/cloud.mjs down
```

调试参数（网址 query）：`?theme=crossborder&ar=16x9&lang=en&cut=15&promo=none&t=6`。

## 实现

```
09-singles-day/
  meta.js         轴、剪辑表（15s 六镜头 / 6s 三镜头复用）、命中点、文件命名
  themes.js       四款主题：配色、星座模式/种子、仓库数、弧线方向、里程碑、调色板
  copy.js         字体、界面用语、里程碑/配音台词与时段
  captions.js     各镜头字幕图层 + fontsFor
  promos.js       片尾卡三预设（none / 1111 / launch）
  layouts.js      每比例 × 每镜头的大屏锚点与文字区
  js/screen.js    大屏引擎：从 constellation 采样，实例化节点/仓库/弧线彗头+拖尾
  js/shots.js     六镜头 countdown / ignite / arcs / gmv / milestone / end
  js/score.js     零点氛围配乐 + 音效 + 片尾动机
  film.js         把数据、场景、镜头交给引擎
  manifest.json   本次出的 2 条
  test/           数据 / 构图 / 文字适配测试
```

渲染要点：
- 大屏是贴在 XY 平面的一块自发光板，相机正视（`dir [0,0,1]`），镜头靠 `anchor`/`size`（layouts）与轻微推拉做运镜。
- 节点 / 仓库 / 弧线都用 `InstancedMesh` + 加法混合。弧线的彗头 / 拖尾网格初始 `count=0`，**必须 `frustumCulled = false`**——否则空包围球会被视锥裁剪整个剔掉（节点因建时就放满实例不受影响，这是本片踩过的一个坑）。
- 帧是（变体, t）的纯函数：`reset(ctx)` 每次求值镜头前把大屏实例全量重绘复位，所以叠化（一帧评估两个镜头）和任意跳转都得到同一帧（`check` 的 determinism 验证 14 帧正反向逐像素一致）。

## 局限

- 本次只出 `national` 的 2 条；其余三款主题、其余语言 / 剪辑的变体引擎都能渲，只是没列进 `manifest.json`。
- 英文 15 秒的片尾 / hero 台词在 2.4 / 2.6 秒槽里偏长（Kokoro 1.15× 仍超），本次 2 条不涉及；若要出 en 15s 需再缩台词。
- 点阵世界地图的大陆是七块椭圆的粗略近似（也正因如此完全没有国界 / 海岸线争议），不是精确海岸线。
- 弧线峰值约四千条实例（彗头 + 拖尾），靠加法辉光伪造「更密」的观感；真要上十万级需进一步 profile 显存。
