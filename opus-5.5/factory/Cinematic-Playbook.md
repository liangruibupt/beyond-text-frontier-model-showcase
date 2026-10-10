# 视觉语言技法库（Cinematic Playbook）

把 [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) 的配方卡与
[awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) 的视觉语言，
映射到本 factory 引擎的**具体可调参数**。改任何一支片子前先过一遍这份清单，逐镜头对照。

> 原则：**不重写引擎，重用引擎**。`post.js` / `framing.js` / `grade.js` / `particles.js` 的
> 电影级能力已齐备，画质提升 = 每个镜头更会用这些能力。首个落地样板是 03 香水（PR #55）。

---

## 0. 引擎能力速查（改片时你能调的旋钮）

| 能力 | 文件 | 关键参数 | 效果 |
|---|---|---|---|
| 浅景深 DoF | `engine/post.js` | `aperture`（0=全清晰，越大越浅）、`maxBlur`（焦外最大模糊，世界单位 ~0.008–0.016） | 主体实、背景熔开，立起纵深 |
| 泛光 Bloom | `engine/post.js` | `bloom.{strength, radius, threshold}`（strength 0.3–0.6 常用，带高光钳制防溢出） | 发光质感、结尾能量冲 |
| 暗角 Vignette | `engine/post.js` | `vignette`（0.28–0.36 常用） | 压暗四周把主体托起，深色反差 |
| 色调映射 | `engine/post.js` | AgX / PBR Neutral（电影感底色，默认已开） | 高光不死白、过渡电影化 |
| 调色 | `engine/grade.js` | lift / gamma / gain、`saturation`、`exposure` | 冷暖、浓淡、明暗 |
| 机位意图 | `engine/framing.js` | `fit`（按 box 框取）/ `blend` / `free`；extra `scale`（推拉）、`box`（动态框） | 推拉、环绕、揭示 |
| 环绕 | `meta.js` VIEW | `yaw:[起,止]`（度，随镜头进度 easeInOut 缓动）、`pitch`、`fov` | 绕主体转出体积 |
| 缓动 | `engine/ease.js` | `easeInOut`、`ss`(smoothstep)、`lerp` | 加速度（不是匀速）→ 速度感 |
| 颗粒/闪白/叠化 | `engine/post.js` | grain / flash / dissolve（CUTS transition） | 胶片质感、节拍冲击、转场 |

---

## 1. 节奏 R（video-shotcraft R 类）

- **R1 字标 hold ≥1s**：品牌 logo/字标开场和结尾各静止驻留 ≥1 秒。
  引擎做法：结尾镜头后半段**停止一切运动**（相机 scale 固定、yaw 到位、无浮动），让字标真静止。
  03 end：`push = easeInOut(ss(0,1.4,lt))` 前 1.4s 推进，后 1.6s push 到顶不动。
- **R2 关键信息落定后呼吸**：数字/卖点出现后 hold ≥1s 再切，不要信息一到就跳。
- **R3 卡点同步**：切点落在节拍网格（本工厂 `GRID=1.5s`，hits 钉在 1.5s 网格）。
- **R4 全画面级冲击 ≤3 处**：闪白/全屏泛光爆发全片不超过 3 次，否则廉价。

## 2. 质感运镜 Q（最吃重，03 的主改方向）

- **Q2 用 DoF 做纵深**：主体特写**必加浅景深**，别靠平光。
  `post = { aperture: 0.42–0.5, maxBlur: 0.012–0.016, vignette: 0.3–0.34 }`。
  长镜 maxBlur 可大（0.014+），1.5s 快镜收一点（0.01）避免背景过虚显空。
- **Q3 运镜稳、慢、小**：环绕要慢且幅度小（10–16° / 镜头），`yaw:[起,止]` 跨度别超 ~18°，
  靠 `easeInOut(s.u)` 自然加减速。大幅摇摆会晕、显廉价。
- **Q5 开场单主角完整弧**：开场立一个主体（可以是产品替身/材质特写，如 03 的露珠），
  给它一个完整动作（露珠长大→坠落）。**诗意材质特写开场是加分项，别无脑换成产品硬出**。
- **Q6 特写环绕 + Q7 深色反差背景**：物件特写要侧倾 + 慢环绕 + **压暗背景**（vignette ↑ / 背景调暗），
  把主体从环境里托出来。亮背景下主体会糊进去。
- **Q8 结尾推到能量峰值**：收尾是全片最高能，不是回落。
  推近（`scale: lerp(1, 1.08, push)`）+ 泛光上扬（`bloom.strength 0.35→0.6`）+ 字标 hold。
  **常见病「头轻尾塌」**：峰值错放中段、结尾慢速去能量化——必改。

## 3. 视觉语言质感（awesome 墙）

爆款质感来自放手让 motion design 发挥 + 这些元素（按引擎能力对应）：

- **粒子氛围场** → `engine/particles.js`（漂浮微粒、尘光，烘托空间）
- **GLSL 辉光/色散** → `post.js` bloom + 色调映射（高光开花、边缘微色散）
- **拖尾彗尾** → 运动主体的 trail（见 09 constellation 的订单弧彗头）
- **景深虚化** → 同 Q2
- **发光描边 / 材质反差** → grade 冷暖对比 + bloom threshold 调节
- **数字滚动 digit-roll** → 计数器缓动（见 09 GMV / shotcraft data 类卡）
- **60fps + 卡点** → 高帧率 + 切点落拍，速度感的底层引擎

## 4. shotcraft 配方卡 → 引擎套用（起点参数）

| 场景 | shotcraft 卡 | 引擎起点 |
|---|---|---|
| 开场揭示 | crane-rise-reveal / brand-ink-open | 特写 hold → `scale` 从大拉到 1.0（`easeInOut`）→ 满幅静止 hold |
| 产品特写 | orbit / turntable | `yaw:[起,止]` 慢环绕 16° + DoF + 压暗背景 |
| 结尾合影 | outro-hero / logo-lock | push-in + bloom 升 + 字标 hold ≥1s |
| 转场 | flash-cut / dissolve | CUTS `transition:{type:'flash'|'dissolve', dur}` |
| 数据 | digit-roll | 计数器 `lerp` 缓动落定后 hold |

> shotcraft 是 Remotion/React，核心是「视觉语言→可执行参数」。手法可直接搬，
> easing/帧数/transform 公式映射到我们的 `easeInOut`/`ss`/`lerp` + `post`/`framing`。

---

## 5. 改片工作流（每支片子）

1. 读 `meta.js`（VIEW/CUTS/EV）+ `js/shots.js`（每镜相机意图 + post override）+ world 定义。
2. 对照 §1–§4 逐镜头诊断：哪条已满足、哪条缺。**先判断「替身开场是否有意设计」再动**（03 的教训）。
3. 改 `meta.js` VIEW（环绕）+ `shots.js`（per-shot post override + 结尾能量）。幅度保守。
4. 本机跑数据测试（layout/overflow/determinism 数据层）确认不破坏。
5. 隔离 worktree + 立即 commit/push（避免并行 session 撞车，06/09 的教训）。
6. 上云 GPU：`check.mjs`（determinism/overflow/audio）→ 关键镜 sheet 审片 → 微调 → `render` 整片。
7. S3 备份（`factory/s3_backup.py` 模式）→ 关 GPU → 合并。

## 6. 不该动的

- 既有的加速度缓动（普遍已用 easeInOut）、节拍同步（hits 钉 1.5s 网格）、光效克制。
- 有意的诗意开场（如 03 macro 露珠→水滴承接）。
- 引擎本身——只调 per-film 的 meta/shots/world 参数。
