# Beyond Text · Frontier Model Showcase

用最新的大模型做文字以外的东西：网页动画、实时 3D、商品视频、配乐和配音。按模型分目录收录代码、素材、工具和说明；由既有项目继续开发的案例，在各目录说明其来源。

| 模型 | 案例 | 类型 | 内容 |
|---|---|---|---|
| [Claude Opus 5.5](opus-5.5/README.md) | 01 [临《兰亭集序》](opus-5.5/01-lantingxu/) | 网页动画（Canvas 2D） | 从神龙本扫描中逐字切分、推出笔路，一管毛笔逐笔临写全篇 324 字，写毕落款、钤印、展卷 |
| [Claude Opus 5.5](opus-5.5/README.md) | 02 [大力神 · 挖地虎合体](opus-5.5/02-devastator/) | 实时 3D 动画（Three.js） | 六台工程车依次变形、对接，合成 G1 大力神；模型、PBR 材质、音效和进行曲配乐全部由代码生成 |
| [Claude Opus 5.5](opus-5.5/README.md) | 03 [闻境 · 香水产品视频工厂](opus-5.5/03-perfume/) | 商品视频工厂（Three.js + Node 批量出片） | 程序建模的八角玻璃瓶，玻璃与液体分层折射、带焦散；四款香型各有场景和配乐，配 Kokoro 配音，按比例、语言、长度、活动批量出片 |
| [Claude Opus 5.5](opus-5.5/README.md) | 04 [有集 · 年度购物报告](opus-5.5/04-year-review/) | 数据驱动盘点视频工厂（Three.js + Node 批量出片） | 按每位顾客的订单数据生成年度盘点视频；数字由代码算出，人设标题和旁白由模型按数据写成，配 Kokoro 配音 |
| [Claude Opus 5.5](opus-5.5/README.md) | 11 [琉光 · 液态玻璃主题视频工厂](opus-5.5/11-liquid-glass/) | 商品视频工厂（全屏着色器 + Node 批量出片） | 弥散渐变壁纸上的磨砂小组件和数字时钟，液态玻璃滑过、折射、相融；三款主题各有配色和配乐，配 Kokoro 配音，批量出片 |
| [GPT-6 Astra](gpt-6-astra/README.md) | [中国古建筑](gpt-6-astra/chinese-architecture/index.html) | 交互式 3D 可视化（Three.js） | 六座木构的三维外观、材质、光照、结构剖面与分层拆解 |
| [GPT-6 Astra](gpt-6-astra/README.md) | [清明上河图](gpt-6-astra/qingming-scroll/index.html) | 原画动画（Canvas 2D） | 原画人物、轿子、动物、树木与水面的局部动态，完整展卷和图片导出 |
| [Claude Fable 5](fable5/README.md) | [太阳系课堂动画](fable5/solar-system/index.html) | 课堂演示（Canvas 2D） | 八大行星轨道、课堂导览、行星竞速、真实直径比例带、开普勒椭圆轨道与等面积演示 |

## 目录约定

- 目录名是模型名的小写短横线写法，如 `opus-5.5/`、`gpt-6-astra/`、`gpt-5.6-sol/`。
- `fable5/` 使用迁移时指定的模型目录名；案例来源见该目录 README。
- 每个模型目录自成一体：有自己的 README、`package.json` 和工具，命令都在这个目录下执行，不引用别的模型目录里的代码。
- 新建案例按 `NN-name/` 编号，编号在各模型目录里各自排；迁入案例可保留原名，避免破坏工具路径。
- 成片和渲染产物（`out/`）不入库。
