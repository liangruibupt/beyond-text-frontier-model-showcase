# 07 开箱 ASMR（场景 E · 方法2 LTX 文生视频）

两款开箱 ASMR 短片：**笔记本电脑**与**无人机**。刀/封条开启 → 包装揭开 → 拨开保护层 → 产品升入光束 → 英雄定格，配 ASMR 拟音与配音旁白。

## 品牌声明

品牌「**开物 KAIWU**」为**虚构品牌**，产品外观为通用工业设计风格，不含任何真实品牌标识。laptop 采用苹果式白色极简包装 + 银色阳极氧化一体机身的**审美风格**（非仿冒任何真实产品）。价格、型号均为虚构。

## 第一轴与交付

- `item`：`laptop`（默认）、`drone`
- 每款 3 条，共 **6 条**（符合工厂统一交付规格）：
  | 视频 | ar | cut | lang | promo |
  |---|---|---|---|---|
  | 16:9 全长中文 | 16x9 | 15 | zh | none |
  | 16:9 全长英文 | 16x9 | 15 | en | launch |
  | 1:1 短版双11 | 1x1 | 6 | zh | 1111 |
- 价格：laptop ¥6999→双11¥5999 / $999；drone ¥3999→双11¥3299 / $599
- 配音：zh `zf_xiaoxiao`、en `bf_emma`（Kokoro）；英文「Double Eleven」

## 方法2 管线（LTX 文生视频 + ffmpeg 后期）

Three.js 程序化 3D 不擅长真实材质 ASMR 质感，故本片走方法2：
1. **文生视频**：`gen/prompts.json` 的 10 条 photoreal 提示词（2 款 × 5 镜头），EC2 g6e.2xlarge(L40S) 上 LTX-2.5 生成（`gen/gen_batch.py`，fp8 + sequential offload，704×480/24fps/24步）。
2. **ASMR 拟音**：`gen/sfx.py` 用 numpy **程序合成**五种拟音（胶带撕裂 tape、纸/膜窸窣 crinkle、升起气流 whoosh、定格叮 chime、英雄低频 hum），确定性、跨进程逐字节一致、零版权依赖——符合场景 E 原设计「sounds are synthesized」。
3. **后期**：`gen/post.py`（ffmpeg 裁剪 + xfade 转场 + Pillow 字幕 overlay + 片尾卡 + Kokoro 配音 + SFX 混音），按剪辑表拼成 6 条成片。

成片在 `out/films/`，画廊接入 `factory/gallery.html?film=07-unboxing`（`gen/gen_index.mjs` 生成 index）。原始 clip + 帧持久备份在 `assets_backup/`。

## 局限（同 06 方法2）

- 配乐缺失（score.js 是 WebAudio 程序配乐，ffmpeg 后期用不了）；本片用 SFX + 旁白替代音乐。
- 字幕用简化安全区定位，非逐镜头 zone。
- clip 为生成式，内容不可逐帧精确控制；靠提示词 + 负面词约束风格。
