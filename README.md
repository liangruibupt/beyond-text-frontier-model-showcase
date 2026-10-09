# Beyond Text · Frontier Model Showcase

用最新的大模型做文字以外的东西：网页动画、实时 3D、商品视频、配乐和配音。按模型分目录收录代码、素材、工具和说明；由既有项目继续开发的案例，在各目录说明其来源。

| 模型 | 案例 | 类型 | 技术 | 内容 |
|---|---|---|---|---|
| [Claude Opus 5.5](opus-5.5/README.md) | 01 [临《兰亭集序》](opus-5.5/01-lantingxu/) | 网页动画 | Canvas 2D · Web Audio | 从神龙本扫描中逐字切分、推出笔路，一管毛笔逐笔临写全篇 324 字，写毕落款、钤印、展卷 |
| [Claude Opus 5.5](opus-5.5/README.md) | 02 [大力神 · 挖地虎合体](opus-5.5/02-devastator/) | 实时 3D 动画 | Three.js（WebGL 2）· GLSL · Web Audio | 六台工程车依次变形、对接，合成 G1 大力神；模型、PBR 材质、音效和进行曲配乐全部由代码生成 |
| [Claude Opus 5.5](opus-5.5/README.md) | 03 [闻境 · 香水产品视频工厂](opus-5.5/03-perfume/) | 商品视频工厂 | Three.js（WebGL 2）· GLSL · Canvas 2D · Web Audio · Node + Playwright + ffmpeg | 程序建模的八角玻璃瓶，玻璃与液体分层折射、带焦散；四款香型各有场景和配乐，配 Kokoro 配音，按比例、语言、长度、活动批量出片 |
| [Claude Opus 5.5](opus-5.5/README.md) | 04 [有集 · 年度购物报告](opus-5.5/04-year-review/) | 数据驱动盘点视频工厂 | Three.js（WebGL 2）· GLSL · Canvas 2D · Web Audio · Node + Playwright + ffmpeg | 按每位顾客的订单数据生成年度盘点视频；数字由代码算出，人设标题和旁白由模型按数据写成，配 Kokoro 配音 |
| [Claude Opus 5.5](opus-5.5/README.md) | 05 [啵茶 BOCHA · 奶茶广告](opus-5.5/05-bubble-tea/) | 商品视频工厂 | Three.js（WebGL 2）· GLSL · Canvas 2D · Web Audio · Node + Playwright + ffmpeg | 珍珠落杯用定步长模拟烘成表，薄壁 PP 杯分层折射，奶柱冲出大理石奶纹、冰块碰撞、杯壁凝水、吸管刺破封膜；四款口味四种风格批量出片，配 Kokoro 配音 |
| [Claude Opus 5.5](opus-5.5/README.md) | 08 [有集次日达 · 一个包裹的旅程](opus-5.5/08-parcel-journey/) | 物流广告视频工厂 | Three.js（WebGL 2）· GLSL · Canvas 2D · Web Audio · LTX-2.5 · Node + Playwright + ffmpeg | 营地灯、电竞耳机、咖啡豆三条送货故事线，每条有代码渲染版和 LTX-2.5 实拍版；实拍版的字幕、片尾卡、价签、配音和配乐仍由引擎叠加，共 19 条成片 |
| [Claude Opus 5.5](opus-5.5/README.md) | 10 [有集直播 · 直播间秒杀 motion pack](opus-5.5/10-live-flash-sale/) | 直播带货视频工厂 | LTX-2.5 · Three.js（WebGL 2）· Canvas 2D · Web Audio · Node + Playwright + ffmpeg | LTX-2.5 生成真人主播实拍画面，引擎叠弹幕、倒计时上链接、购物车弹窗、红包雨、库存条到「已抢光」；先对比了 LTX-2.5、Wan 2.2、MiniMax H3，三件商品共 9 条成片 |
| [Claude Opus 5.5](opus-5.5/README.md) | 11 [琉光 · 液态玻璃主题视频工厂](opus-5.5/11-liquid-glass/) | 商品视频工厂 | GLSL 全屏着色器（WebGL 2，经 Three.js）· Canvas 2D · Web Audio · Node + Playwright + ffmpeg | 弥散渐变壁纸上的磨砂小组件和数字时钟，液态玻璃滑过、折射、相融；三款主题各有配色和配乐，配 Kokoro 配音，批量出片 |
| [Claude Opus 5.5](opus-5.5/README.md) | 12 [六只绒毛波普猫猫](opus-5.5/12-pop-cats/) | 矢量插画 | SVG（程序生成）· resvg | 参照宠物零食的波普海报画出六只不同品种的猫：短绒毛团子脸、马克笔式淡描边、花色边缘一丝一丝晕开；每只猫由带种子的纯函数生成，导出 SVG / PNG 和拼贴海报 |
| [Claude Opus 5.5](opus-5.5/README.md) | 13 [纽约地铁 · 百年沙画](opus-5.5/13-nyc-subway-sandart/) | 沙画解说视频 | Canvas 2D · Node + Playwright + ffmpeg · Kokoro TTS | 金色沙粒带压感逐笔落在纸上，12 幕画出纽约地铁从 1869 到今天的发展史，换幕用流沙吹散再堆成下一幕；每幕绘制时长由配音时长驱动，中文旁白用部署在 AWS 的 Kokoro Lambda 合成，片尾定格在官方风格的实心彩色线路字母球 |
| [GPT-6 Astra](gpt-6-astra/README.md) | [中国古建筑](gpt-6-astra/chinese-architecture/index.html) | 交互式 3D 可视化 | Three.js（WebGL 2）· SVG | 六座木构的三维外观、材质、光照、结构剖面与分层拆解 |
| [GPT-6 Astra](gpt-6-astra/README.md) | [清明上河图](gpt-6-astra/qingming-scroll/index.html) | 原画动画 | WebGL 1 · GLSL | 原画人物、轿子、动物、树木与水面的局部动态，完整展卷和图片导出 |
| [Claude Fable 5](fable5/README.md) | [太阳系课堂动画](fable5/solar-system/index.html) | 课堂演示 | Canvas 2D | 八大行星轨道、课堂导览、行星竞速、真实直径比例带、开普勒椭圆轨道与等面积演示 |

WebGL 是浏览器里的 OpenGL ES（WebGL 1 对应 ES 2.0，WebGL 2 对应 ES 3.0），GLSL 是它的着色器语言；Three.js 是建在 WebGL 之上的 3D 库。Canvas 2D 用来画字、界面和平面动画，Web Audio 用代码合成音效和配乐。视频工厂用 Node 驱动 Playwright 里的无头 Chromium 逐帧渲染，再由 ffmpeg 编码成片。

## 目录约定

- 目录名是模型名的小写短横线写法，如 `opus-5.5/`、`gpt-6-astra/`、`gpt-5.6-sol/`。
- `fable5/` 使用迁移时指定的模型目录名；案例来源见该目录 README。
- 每个模型目录自成一体：有自己的 README、`package.json` 和工具，命令都在这个目录下执行，不引用别的模型目录里的代码。
- 新建案例按 `NN-name/` 编号，编号在各模型目录里各自排；迁入案例可保留原名，避免破坏工具路径。
- 成片和渲染产物（`out/`）不入库。
