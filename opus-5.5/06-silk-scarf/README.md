# 06 丝巾（场景 D · 锦时 JINSHI）

四款真丝方巾广告，每款**独立一套分镜**（场景、光、配乐各不相同），不是换皮。品牌「**锦时 JINSHI**」为**虚构品牌**。

## 第一轴与交付

- `scarf`：`dunhuang` 敦煌藻井（默认）、`songjin` 宋锦八达晕、`qinghua` 青花缠枝莲、`yunhe` 云鹤
- 价格：¥399 → 双11 ¥299 / $59
- 每款 3 条，共 **12 条**（工厂统一交付规格）：16:9/15s/zh/none（标语）、16:9/15s/en/launch、1:1/6s/zh/1111（双11）
- 字幕「桑蚕丝 · 十六姆米」；配音 zh `zf_xiaoxiao`、en `bf_emma`

## 四套分镜

- **敦煌「飞天」**：风起洞窟 → 飘带盘旋上升 → 藻井下展开对纹 → 落人台肩 → 环绕。烛光洞窟，琵琶 + 手鼓。
- **宋锦「织」**：光作梭逐行织出 → 织成 → 提起离机起伏 → 空中三折 → 落盒合盖。素绢屏风天光，古琴 + 箫。
- **青花「瓷」**：毛笔画缠枝莲 → 钴蓝晕开 → 化作丝巾裹梅瓶滑落 → 褶子微距 → 升起俯看。白瓷冷硬光，钢片琴 + 弦乐。
- **云鹤「鹤」**：暮色云海明月 → 两角扇动如鹤掠月 → 贴身跟拍鹤纹 → 收翅落逆光人台 → 慢推。暮色逆光，合成器 + 笙。

共用：片尾卡（end 12–15 四款共用，三型：标语/新品/双11价签）。剪辑表 `meta.js` 的 `BOARDS`（0.75s 网格，80bpm）。

## 两套实现

- **方法1（程序化 3D）**：`js/`（`scarf.js` 布料、`sims.js` 滑落碰撞、`worlds.js` 场景、`score.js` WebAudio 配乐等）+ `film.js`。引擎能力 `factory/engine/cloth.js`（建在 `bake.js` 上）+ `film.cutFor(v)` 变体剪辑表（PR #12）。网页预览 `factory/` 工厂管线渲染。
- **方法2（LTX 文生视频）**：`gen/`——Opus 写提示词（`prompts.json`，20 镜头）→ EC2 g6e.2xlarge(L40S) LTX-2.5 生成（`gen_batch.py`）→ ffmpeg 后期（`post.py`：裁剪 + xfade + Pillow 字幕 + 片尾卡 + Kokoro 配音）→ 12 条成片。画廊 `factory/gallery.html?film=06-silk-scarf`（`gen_index.mjs`）。详见 `gen/DEPLOYMENT-method2.md`。

## 局限（方法2）

配乐缺失（`score.js` 是 WebAudio 程序配乐，ffmpeg 后期用不了）；字幕用简化安全区定位，非逐镜头 zone。方法1 保留完整配乐与程序化渲染。
