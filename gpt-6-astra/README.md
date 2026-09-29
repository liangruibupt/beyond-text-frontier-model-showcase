# GPT-6 Astra · Multimodal Showcase

从 `claudecode-myagents` 迁入的两个交互式案例，收录 GPT-6 Astra 继续开发后的当前版本。
模型目录用于归档当前版本，不代表全部历史代码均由同一模型从零生成。

| 案例 | 预览入口 | 内容 |
|---|---|---|
| 中国古建筑 | [chinese-architecture/index.html](chinese-architecture/index.html) | 六座木构的三维外观、材质、光照、结构剖面与分层拆解 |
| 清明上河图 | [qingming-scroll/index.html](qingming-scroll/index.html) | 原画人物、轿子、动物、树木与水面的局部动态，完整展卷和图片导出 |

直接用浏览器打开各案例的 `index.html`，无需启动服务器。代码和素材不依赖
`myagents` 或其他模型目录。古建筑的 Google Fonts 为可选在线字体，离线时使用本地字体。
两例的历史准确性、动画覆盖范围和素材许可，分别见各自的 README。

## 验证

以下命令均在本目录 `gpt-6-astra/` 下执行：

```sh
npm test
# 需要重新打包古建筑的 Three.js 依赖时：
npm ci --prefix chinese-architecture
npm run build:architecture
```

`npm test` 运行两个项目的 Node 测试，不要求全局安装 Codex 或 Python。
浏览器验证脚本的输出统一写到本目录的 `output/playwright/`，不入库。
古建筑依赖的本地打包版本已随项目提供。清明上河图仅在重建素材时需要
Python、Pillow、NumPy 和 OpenCV。

## 来源与迁移

- 源仓库：[liangruibupt/claudecode-myagents](https://github.com/liangruibupt/claudecode-myagents)。
- 迁移基线：`99f8c76526b77c94c71c80dd4abe8e98031a0819`，日期 2026-09-29。
- `qingming-scroll` 包含该提交中的动画、网格约束、测试和上下文恢复工具。
- `chinese-architecture` 同时保留迁移前尚未提交的三维外观升级及相关测试。
  既有二维剖面代码可追溯至源仓库的 `a06431a420649d10ffda867d6f41d58fa128216d` 等提交。
- 保留原项目目录名。原仓库的 Git 历史和历史设计文档不改写、不删除。
- 原仓库中的旧测试截图不作为发布素材迁入；可在这里重新生成。
- `solar-system` 按核实的提交署名和用户确认，另归档于 [fable5/](../fable5/README.md)，不标注为 GPT-5.6 Sol。

继续开发时先阅读各案例的 `HANDOFF.md`。不要把图片的 Base64、打包依赖、
完整浏览器日志或旧会话全文放进模型上下文。
