# 05 · 啵茶 BOCHA —— 奶茶广告视频工厂

一支 15 秒的奶茶广告：珍珠一颗颗落进空杯、茶汤涨上来、鲜奶冲下去卷出奶纹、冰块落进杯里碰出一声、整杯环绕时杯壁凝出水珠并滑下一颗、吸管压下刺破封膜，最后是片尾卡。四款口味各有自己的茶汤颜色、珍珠、背景色和文案；同一个模板批量出三种画面比例 × 四款口味 × 中英文 × 15 / 6 秒 × 三种片尾活动。

> 「啵茶 BOCHA」是为本案例虚构的品牌，口味、价格和活动都是示例数据，与任何真实品牌或商品无关。

分镜见 [docs/specs/2026-09-30-05-bubble-tea-storyboard.md](../docs/specs/2026-09-30-05-bubble-tea-storyboard.md)。

## 四款四种风格

杯子、珍珠、奶、冰、吸管和剪辑表四款共用；场景、光、字体与字幕处理、机位、配乐按口味分开，整张表在 `styles.js`，四个场景在 `js/worlds/`。

| 口味 | 场景 | 光 | 字 | 机位 | 配乐 |
|---|---|---|---|---|---|
| 黑糖珍珠 | 深夜糖铺 `syrup`：旧木台面、蒸汽、暖色光斑 | 暗房，琥珀色侧逆光 | 宋体 Noto Serif SC / Playfair，暖光晕 | 低机位慢推 | Lo-fi 爵士，Rhodes + 摇摆鼓，F 调 |
| 茉莉奶绿 | 清晨茶席 `teatable`：亚麻、茉莉枝、落花 | 明亮窗光，窗棂投影 | 霞鹜文楷；16:9 中文竖排 | 高机位横移 | 古筝 + 笛，无鼓，D 调 |
| 草莓啵啵 | 夏日波普 `pop`：几何色块、飞草莓片与圆点 | 硬光，饱和粉 | 站酷快乐体 / Fredoka，贴纸字 | 荷兰角 + 推 | 泡泡糖流行，最密，C 调 |
| 芋泥 | 紫雾云朵 `cloud`：雾团、光球、漂浮芋头块 | 柔光薰衣草雾 | 细体 Noto Sans SC 300 / Quicksand，淡出 | 慢环绕 | 梦幻合成器 + 钢片琴，最疏，A♭ 调 |

## 做法

| | |
|---|---|
| **珍珠** | 60 颗珍珠的碰撞写不成闭式：在 `setup` 里用 [`factory/engine/bake.js`](../factory/README.md#烘焙模拟bakejs) 按 1/240 秒的步长跑一遍（重力、空气阻尼、珠对珠、杯底、截锥杯壁），存成表，镜头每帧按 t 取样。烘一次约 60 ms，两次逐字节相同 |
| **杯子与茶汤** | 薄壁 PP 杯接到共享的 [分层折射模块](../factory/README.md#分层折射enginerefractjs)（`frustumShape`，截锥）：茶汤是乳浊液体（`scatter`），液面以上留 2.4 cm 空气，折射在杯壁、空气段和液面上看得出来；冰块走 `contents` 层 |
| **奶纹** | 闭式颜色场（`js/milk.js`），接在折射材质后面只改液体的颜色：一道随进度往下推的密度前沿 + 值噪声域扭曲卷出大理石纹，黑糖款再加沿杯壁往下挂的虎纹，顶上一层清茶 |
| **注奶** | 一道奶柱从画面上方冲进杯里，茶汤从珍珠层上面涨到满杯；奶柱和冷凝画在折射之后的 over 层，挡在杯壁前面也不会被盖掉 |
| **冷凝与滴落** | 200 颗水珠的位置和大小由 `rand(seed, i)` 定，随 t 长大，只靠清漆高光读出来；正面偏上那颗在 hero 的 1.5 秒开始滑落。都是闭式，拖动时间轴和顺序播放一致 |
| **配乐与配音** | 每款一套编配（`js/score.js` 的 `ARR`）：调、和弦、音阶、主奏音色和密度各不同（测试检查四款调式互异、密度草莓 > 黑糖/茉莉 > 芋泥），命中点音效和三音 logo 动机共用。配音用 Kokoro，中文 `zf_xiaoyi`、英文 `af_heart`，64 句，数字一律念成字；英文画面写 "Double 11"，配音念 "Double Eleven" |
| **封膜与吸管** | 封膜按一条光滑的曲线被压凹，吸管在 straw 镜头的 0.75 秒刺破，中心换成六瓣往下翻，吸管插到底，把附近的珍珠推开一点 |

## 交付

`manifest.json` 12 条，每款口味 3 条；全部 −14 LUFS 左右、真峰值 ≤ −1.5 dBTP。

| 口味 | 16:9 · 15 秒 · 中文 | 16:9 · 15 秒 · 英文 · 新品 | 1:1 · 6 秒 · 中文 · 双11 |
|---|---|---|---|
| 黑糖珍珠 `brownsugar` | `bocha_brownsugar_15s_16x9_zh` | `bocha_brownsugar_15s_16x9_en_launch` | `bocha_brownsugar_6s_1x1_zh_1111` |
| 茉莉奶绿 `jasmine` | `bocha_jasmine_15s_16x9_zh` | `bocha_jasmine_15s_16x9_en_launch` | `bocha_jasmine_6s_1x1_zh_1111` |
| 草莓啵啵 `strawberry` | `bocha_strawberry_15s_16x9_zh` | `bocha_strawberry_15s_16x9_en_launch` | `bocha_strawberry_6s_1x1_zh_1111` |
| 芋泥 `taro` | `bocha_taro_15s_16x9_zh` | `bocha_taro_15s_16x9_en_launch` | `bocha_taro_6s_1x1_zh_1111` |

成片在 `out/`（按 .gitignore 不入库）。g6/g5 单卡 3 路并行约 10 分钟出完 12 条。

## 运行

```bash
cd opus-5.5
npm run serve
# http://127.0.0.1:8765/05-bubble-tea/?ar=16x9
node factory/check.mjs 05-bubble-tea     # 要 GPU：确定性、配音、音频、字幕溢出、速度
node factory/render.mjs 05-bubble-tea --workers 3
FUNC=<kokoro-tts arn> REGION=us-east-1 node factory/vo.mjs 05-bubble-tea   # 改了台词才要重新生成
```

## 实现

```
05-bubble-tea/
├── meta.js       轴、剪辑表（15 / 6 秒）、命中点、封面、杯子尺寸与各镜头机位、文件命名
├── film.js       成片模板：按口味选场景，搭杯子 + 折射 + 奶纹、复位、分层渲染、镜头、配乐、配音
├── flavors.js    四款口味：名称、意象句、价格（整数）、茶汤光学参数、珍珠、背景与配色
├── styles.js   四款风格表：场景、字体、字幕处理、机位、调色
├── copy.js       字体、界面用语、配音台词与时段（zh zf_xiaoyi，en af_heart）
├── captions.js · promos.js · layouts.js · manifest.json（12 条）
├── js/
│   ├── pearls.js 珍珠落杯的烘焙模拟
│   ├── cup.js    杯子、茶汤、冰块、冷凝水珠、封膜、吸管、珍珠的摆放（pose）
│   ├── tea.js    接到共享折射模块
│   ├── milk.js   奶纹、虎纹、清茶层的颜色场
│   ├── worlds/   四个场景（syrup · teatable · pop · cloud）+ common.js
│   ├── shots.js  六个镜头
│   └── score.js  配乐与音效
├── assets/vo/    配音片段（64 句 mp3 + index.json）
└── test/         数据与清单、构图、字幕尺寸、珍珠模拟、杯子与逐帧确定性、配乐
```
