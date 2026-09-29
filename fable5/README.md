# Fable 5 · Solar System Classroom Showcase

[打开太阳系动画](solar-system/index.html)

从 `claudecode-myagents/solar-system/` 迁入的单文件 Canvas 2D 课堂演示。
直接在浏览器打开 `solar-system/index.html`，不需要服务器或依赖安装；
Google Fonts 为可选在线字体，离线时使用本地字体。

## 内容

- 太阳与八大行星的轨道动画，以及行星资料。
- 课堂导览、行星竞速、真实直径比例带。
- 开普勒椭圆轨道与等面积演示。
- 播放、暂停、速度控制、全屏与投影模式。

轨道速度保留相对关系，距离与主画面中的天体大小经过示意化处理，
不应将主画面当作真实空间比例模型。

## 验证

在 `fable5/` 目录执行 `npm test`，无需安装第三方包。
静态测试检查单文件脚本语法、关键入口和本地资源引用。
浏览器验证另覆盖实际画布加载、动画和暂停/继续。

## 来源

- 源仓库：[liangruibupt/claudecode-myagents](https://github.com/liangruibupt/claudecode-myagents)。
- 迁移日期：2026-09-29；保留 HTML 原样，没有重写太阳系动画。
- 最近七次功能提交（`d0bc57d` 至 `6166a70`）均含
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 最初纳入 Git 的 `0179ac3` 提交署名包含 Claude Opus 4.6；
  它是混合内容的导入提交，不能仅凭该署名断言原始动画的生成模型。
- 未找到 GPT-5.6 Sol 的可核实记录。按用户确认使用 `fable5/` 目录。
- 历史提交、设计文档和实施计划保留在源仓库。

迁移前的 `solar-system/index.html` SHA-256：

```text
904637a7baaf5476f8c40d498e7cbb54da16b2a0d24d4a9389dadb2e4c2ddb8c
```
