<!-- 2026-10-08 由 Kiro (KiroCrew) 起草，待用户批。方法一 code-authored（Three.js + Canvas motion graphics，确定性出帧）。 -->

# 09 · 双11 零点大屏（Singles' Day war room）：分镜草案（待批）

## A. 概念

- **主题**：双11 零点作战大屏 —— 倒计时归零的那一刻，全国订单像星座一样点亮，GMV 计数器一路狂飙，里程碑逐个爆屏。motion graphics + 实例化 3D 订单弧线（目标约 100k 条，分批实例化绘制）。
- **「订单星座」布局（已拍板 2026-09-30）**：**不画任何地理边界、不用标准地图**（避开送审）。城市用一组**抽象散点**代表 —— 每个城市一个发光节点，节点位置用固定种子的程序布局（力导向/泊松盘散点）铺在深色画布上，形成「星座」而非地图。订单弧线从各城市节点飞向少数几个「仓库」汇聚节点。观众读到的是「全国海量订单奔向仓库」的峰值叙事，而不是一张中国地图。
- **画面与情绪**：深空蓝黑背景，节点与弧线用品牌色霓虹辉光，数据感、工业感、紧张的零点氛围。全部 on-screen 文字由时间线驱动（非 CSS 过渡），每帧确定性渲染，便于云端批量出帧。
- **品牌**：虚构大促品牌「**星潮 STARTIDE**」（README 写明虚构），避免影射真实平台。所有 GMV / 订单数字都是**代码算出来的虚构数据**（固定种子），不代表任何真实平台。

## B. 产品线（第一轴 `theme`）—— 四个变体

09 没有「实物产品」，第一轴改为**大屏主题**，四款各有不同配色、星座分布种子、仓库数与里程碑文案（符合既定「第一轴 4 值 × 3 交付 = 12 条」）：

- `national` 全国总览（默认）：冷蓝主色，星座铺满全屏，8 个仓库汇聚节点，里程碑是「破亿/破十亿」GMV。
- `megacity` 核心都市圈：品红主色，星座聚成 3 个高密团簇（代表三大城市群），里程碑是「单城破亿」。
- `crossborder` 全球跨境：青绿主色，星座分内外两环（国内环 + 海外环），弧线跨环飞行，里程碑是「X 国同时下单」。
- `logistics` 物流履约：琥珀金主色，弧线反向（仓库→星座，代表发货），里程碑是「X 单已发出 / 分钟」。

> 四款是「四套不同的大屏视角」，星座种子、配色、仓库布局、里程碑文案各不相同（参照 06 四款不同分镜的做法），不只是换皮。

## C. 镜头表（15 秒版）

80 bpm，一小节 3 秒，命中点落在 0.75 秒网格上。

| # | 时间 (s) | 镜头 | 画面 | 字幕 zh | 字幕 en | 命中点 | 声音 |
|---|---|---|---|---|---|---|---|
| 1 | 0–2.25 | `countdown` | 全黑场中央大号倒计时 `3·2·1`（10→0 压缩进这段，大数字跳动），背景星座节点微弱呼吸式闪烁待命 | 「零点将至」 | "Midnight approaches" | 每 0.75 一跳，2.25 归零 | 低音脉冲每拍一下，渐强 |
| 2 | 2.25–5.25 | `ignite` | 归零瞬间全屏星座节点**依次点亮**（按与仓库距离的波纹扩散），弧线开始从四面飞起 | 「全国订单，瞬时点亮」 | "Orders light up nationwide" | 2.25 点亮爆发（第二小节首拍），3.0 弧线起飞 | 爆发 `whoosh` + 和弦铺底进 |
| 3 | 5.25–8.25 | `arcs` | 镜头缓拉远/环绕，海量弧线（实例化，批次递增到峰值密度）从星座飞向仓库，仓库节点随到达脉冲变亮 | 「每秒百万笔」 | "Millions per second" | 6.0 密度峰值落拍，7.5 一次仓库脉冲 | 主旋律进，7.5 轻 `bell` |
| 4 | 8.25–11.25 | `gmv` | 硬切到 GMV 计数器主视角：巨大数字滚动加速（代码缓动，非逐字乱跳），背景弧线虚化流动 | 「成交额」+ 滚动数字 | "GMV" + rolling number | 8.25 落拍，9.75 数字加速档位切换 | 计数器滴答声随速度升调 |
| 5 | 11.25–12.0 | `milestone` | 里程碑爆屏：一行大字冲入（如「¥10B·1分36秒」），星座全亮一次做背景闪 | 里程碑句 | milestone line | 11.25 爆屏命中 | 一记重音 `hit` + 全亮 |
| 6 | 12.0–15.0 | `end` | 大屏收束成品牌卡缓慢旋转/呼吸，下方片尾卡（0.4 s 叠化切入） | 品牌 + 活动 | 品牌 + 活动 | 12.0 品牌动机 | 三音动机 + 收尾 |

时长 2.25 + 3.0 + 3.0 + 3.0 + 0.75 + 3.0 = 15 秒。

> 注：镜头 1 的 `countdown` 把原需求的 10→0 做成「大数字快速跳动压缩进 2.25 s」，而非真实 10 秒，以适配 15 秒总长；读到的仍是「倒计时归零」。

## D. 剪辑表

```js
15: { shots: [
  { shot: 'countdown', dur: 2.25 },
  { shot: 'ignite',    dur: 3.0 },
  { shot: 'arcs',      dur: 3.0 },
  { shot: 'gmv',       dur: 3.0, transition: { type: 'dissolve', dur: 0.25 } },
  { shot: 'milestone', dur: 0.75, transition: { type: 'flash', dur: 0.15 } },
  { shot: 'end',       dur: 3.0, transition: { type: 'dissolve', dur: 0.4 } },
], hits: { tick: 0.75, zero: 2.25, ignite: 2.25, launch: 3.0, peak: 6.0, pulse: 7.5, gmv: 8.25, gear: 9.75, burst: 11.25, logo: 12.0 }, cover: 11.4 },

6: { shots: [
  { shot: 'ignite',    dur: 1.5, from: 0.75 },                                        // 入画即点亮爆发
  { shot: 'milestone', dur: 1.5, from: 0.0, transition: { type: 'flash', dur: 0.2 } }, // 里程碑爆屏
  { shot: 'end',       dur: 3.0, transition: { type: 'dissolve', dur: 0.3 } },
], hits: { ignite: 0.0, burst: 1.5, logo: 3.0 }, cover: 4.4 },
```

- 6 秒版只用 `ignite`（点亮爆发）+ `milestone`（里程碑）+ `end`，复用 15 秒的镜头（`from` 切入），只出 1:1 双11。
- 1:1 价签/里程碑照 03 的 `promoLayers` 放在 `end` 的三个区；大屏主体挪上方（anchor [0.5, 0.30]，size 0.42）。双11 到手价字号在 1080×1080 上 ≥ 3.5% 短边。

## E. 轴

- `theme: ['national', 'megacity', 'crossborder', 'logistics']`（默认 national）
- `lang: ['zh', 'en']`
- `cut: [15, 6]`
- `promo: ['none', '1111', 'launch']`
- `sceneAxes: ['theme']`：换主题就换配色、星座种子/分布、仓库数与布局、里程碑文案与弧线方向（物流款反向）。其余轴即时切换。
- 文件名：`fileName = startide_${theme}_${cut}s_${ar}_${lang}[_promo][_novo]`

## F. 配音台词

| id（`${theme}_${lang}_${cut}_…`） | zh | en | 开始 | 最长 |
|---|---|---|---|---|
| `hook` | 零点已到，全国点亮。 | Midnight strikes, the nation lights up. | 0.4 | 2.3 |
| `hero` | 每秒百万订单，奔向仓库。 | A million orders a second, racing to the warehouse. | 5.5 | 2.6 |
| `end_none` | 星潮双十一，峰值即巅峰。 | STARTIDE Double Eleven — peak means the summit. | 12.3 | 2.4 |
| `end_launch` | 星潮大屏，全新上线。 | STARTIDE war-room, newly launched. | 12.3 | 2.3 |
| `one_1111`（6 秒） | 星潮双十一，成交额破十亿只用一分三十六秒。 | STARTIDE Double Eleven — ten billion in one minute thirty-six. | 1.7 | 3.6 |

- 每款主题换 hero 句与里程碑句（megacity「单城破亿」/ crossborder「X 国同时下单」/ logistics「每分钟 X 单已发出」）。
- 数字一律 `sayNum` 转字（「十亿」「一分三十六秒」）。画面写 "Double 11"，配音念 "Double Eleven"。
- 音色建议：中文 `zf_xiaoxiao`，英文 `bf_emma`（待用户定；可先 `--audition`）。

## G. 清单（2026-10-08 用户缩范围）

**只做 2 条**（不是 12 条），主题取默认 `national`：
- `startide_national_15s_16x9_zh`（15 秒 · 16:9 · 中文 · 片尾 tagline+buy）
- `startide_national_6s_1x1_en_1111`？→ 用户要的是 **6s 英文**。6 秒版原规格是「1:1 zh 1111」，用户改为**英文**：出 `startide_national_6s_1x1_en`（6 秒 · 1:1 · 英文）。promo 用 `launch`（英文版片尾，不混双11中文价签）或 `none`，开工时按 end 卡可读性定，默认 `launch`。

两条都带配音，完成后放进 `factory/gallery.html?film=09-singles-day`。其余轴（megacity/crossborder/logistics、其余语言/剪辑）此次不出，但 `film.js` 的轴定义仍保留完整（引擎按变体渲染，只是 manifest 只列这 2 条）。

## H. 引擎工作：「订单星座」布局（唯一新增引擎能力，单独立项带测试）

TASKS 列的 09 新增能力是「订单星座布局（不画地理边界）」。设计为一个可测的纯函数模块：

**`factory/engine/constellation.js`**（建在既有 `rng.js` 上，确定性）：
- `layoutNodes({ seed, count, clusters, aspect })` → 返回归一化坐标 `[{x, y, w}]`（泊松盘散点或力导向，固定种子 → 逐次相同），`clusters` 控制团簇数（megacity 用 3 团，national 均铺，crossborder 内外两环）。
- `layoutHubs({ seed, nodes, k })` → 从节点中选/放 `k` 个仓库汇聚点。
- `arcPath(from, to, t, lift)` → 一条弧线在参数 t∈[0,1] 的点（二次贝塞尔，`lift` 控制拱高），供实例化弧线按进度采样。
- `arcSchedule({ seed, nodes, hubs, n, t0, t1 })` → 为 n 条弧线分配 (起点节点, 终点仓库, 起飞时刻, 时长)，固定种子 → 相同调度，支持按 t 乱序/倒序采样（配合 scrub 与叠化）。
- **测试断言**：同种子两次布局逐值相同；节点数 = count；团簇模式下节点落在对应团簇内；`arcPath(.,.,0)=from`、`arcPath(.,.,1)=to`；弧线调度按 t 乱序取样结果与顺序一致；无任何 `Math.random/Date.now/performance.now`，随机只来自 rng.js。

> 100k 弧线：用 Three.js `InstancedMesh`（或实例化线段）按 `arcSchedule` 的活跃集每帧更新实例矩阵；密度随 `arcs` 镜头推进分批升到峰值。先做引擎模块 + 测试并合入，再写 09 代码（照 05/06 的顺序）。

## I. 风险与简化退路

- **100k 弧线性能**：云 GPU 批量出帧每帧是离线渲染（不要求实时 60fps），但仍要控内存。退路：峰值密度降到 ~30k 实例 + 用加法混合的辉光伪造「更密」观感；或弧线用屏幕空间 Canvas 2D 批绘而非 3D 实例。先按 3D 实例做，profile 后定。
- **GMV 计数器滚动**：必须是 t 的纯函数缓动（code-authored easing），不得逐帧随机跳字；大数字用等宽字形避免抖动。
- **里程碑爆屏仅 0.75 s**：命中要狠；若太仓促，退路是把 `arcs` 压到 2.25 s、`milestone` 给到 1.5 s。
- **跨境款海外环**：仍是抽象散点双环，不画任何国界/海岸线，继续规避标准地图送审。
- 不做真实地理定位、不做真实平台数据；全部虚构 + 固定种子。

## J. 顺序（照 skill）

1. 先把引擎能力 `constellation.js` 做完、带测试、合入 master；
2. 脚手架 `09-singles-day/`，占位镜头跑通 `npm test` + `check.mjs` + 预览页；
3. 六个镜头逐个做、逐个给你看样张（16x9 中英 + 6 秒用到的 1:1）；
4. 配乐 `score.js` + Kokoro 配音（部署前/调用前问你）；
5. 云 GPU 批量出 12 条 → gallery 评审 → README + 根索引 → 提交。
