# 10 · 直播间秒杀 整片 AI 变体：三模型对比（stage A，2026-10-08）

代码搭建的 3D 影棚被判「太丑了」（r5, 724d69e）。改走 08 的 AI 路线：视频模型只生成**画面**——
一位真实的年轻中国女主播在明亮的现代直播带货影棚里演示商品；引擎照旧在上面叠直播间图形包
（外框、弹幕、倒计时、购物车弹窗、红包雨、库存条、已抢光）、字幕、配音和配乐。

本次是 **stage A 对比**：同一组镜头、同一取景、同一种子（1111），把 `lantern`（营地灯）的
**`room`**（主播挥手、商品在桌上）和 **`cart`**（主播把营地灯举近镜头）两镜、**只做 16:9（1280×704，73 帧 ≈ 3 秒）**，
分别交给 LTX-2.5 / Wan 2.2 / MiniMax H3，比速度、显存、成本和画质。提示词见 `../shots.json`，对比配置见 `../bakeoff.json`。

## 结论：**stage B 选 LTX-2.5（蒸馏版 + FP8）为主**，Wan 2.2 TI2V-5B 作为备选 / 特定镜头补充

| | LTX-2.5 distilled FP8 | Wan 2.2 TI2V-5B | MiniMax H3（开源权重） |
|---|---|---|---|
| 机器 | g6e.2xlarge · L40S 48GB · ap-northeast-1 | g6e.2xlarge · L40S 48GB · us-east-2 | g6e.4xlarge · L40S 48GB · us-west-2 |
| 结果 | **2/2 成功**，ffmpeg 校验通过 | **2/2 成功**，ffmpeg 校验通过 | **0/2**，画面未生成（见「失败」） |
| 代码路径 | `ai/ltx/setup.sh` + `ai/ltx/gen.py`（常驻单次加载） | `ai/wan/setup.sh` + `ai/wan/gen.sh`（`generate.py --task ti2v-5B`） | `ai/minimax/setup.sh` + `ai/minimax/gen.py`（ComfyUI 原生节点，headless API） |
| 采样步数 | 8 + 4（两阶段蒸馏） | 50（默认） | — |
| 模型加载 | 89 s（常驻，仅一次） | 每段各自加载（≈2 min） | ComfyUI 启动 98 s（权重已下载） |
| GPU 时间 / 段 | room 376 s、cart 327 s（含两阶段 + 上采样 + 解码） | 每段 914 s（约 4.75 s/步 × 50 + VAE 解码） | — |
| 显存峰值 | **24.6 GB** / 48 | 33.4 GB / 48 | boot 后 0.4 GB（未进采样） |
| 反向提示词 | 蒸馏版不支持（无 CFG），**未施加** | `generate.py` 该版无 `--negative` CLI，**用内置默认** | 规划支持（正/负两路编码），未跑到 |
| 权重 | HF 受限仓库（需同意许可 + token） | 公开，**无需 token** | HF Comfy-Org 重打包（社区许可，可带 token） |
| 许可 | LTX 社区许可 | **Apache 2.0** | MiniMax H3 社区许可 |
| 估算成本（本次）| ≈ US$1.6（≈43 min × $2.24/h） | ≈ US$1.9（≈52 min × $2.24/h） | ≈ US$3.5（两次尝试，首次 import 失败 ~30 min + 重跑 ~40 min × $3.0/h） |

**三模型 stage A GPU 总花费 ≈ US$7**，远低于 ≤ US$60 的预算（MiniMax 没有触发「超预算」条款，是代码问题不是算力问题）。

对比网格：`../../../.scratch/look/10ai-bake-grid.png`（行 = 模型 LTX / Wan / MiniMax，列 = room 中帧 / cart 中帧 / cart 末帧；MiniMax 行为失败占位）。
单帧：`../../../.scratch/look/10ai-bake-<model>-<room|cart>-<mid|last>.png`。每段的全部帧与原片在
`../../out/ai/<model>/`（按仓库规则不入 git）。

## 画质（看过帧，不是只读日志）

**LTX-2.5 —— 推荐。**
- `room`：真实的年轻中国女主播，脸、皮肤、挥手的手都自然（五指正确），暖笑；绿白营地灯在桌上、暖光亮着；
  环形灯入镜，背后货架上的商品盒自然虚化。**画面里没有任何文字 / logo**，上方约 40% 相对干净，能放弹幕。
- `cart`：主播把营地灯举近镜头，商品锐利可辨，手自然，背景暖调虚化，产品还原度高。
- 整体：真实的直播间「临场感」最强，像随手一拍的带货直播，不油。中帧→末帧产品稳定、无漂移、无闪烁。
- 缺点：相比 Wan，单帧的「精修感」稍弱；蒸馏版吃不进反向提示词（本片画面里本来也不该出现文字，影响不大）。

**Wan 2.2 TI2V-5B —— 备选。**
- 在 48GB L40S 上**两段都成功**——08 里它曾在 24GB L4 上 VAE 解码 OOM，这次换 48GB 卡 + `--offload_model` 顺利跑完，峰值 33.4GB。
- `room`：非常「精修」的广告/商拍质感，主播脸自然好看，大环形灯抢眼，营地灯还原好。
- `cart`：主播双手把灯递向镜头，手指正确，产品细节比 LTX 更多（能看到卡扣、散热口）。
- **缺点（关键）**：反向提示词进不去 `generate.py` 这版 CLI，背景货架上的商品盒**长出了红/黑印刷字和标签**，
  灯座上也出现了一小块印刷字——引擎要在画面上叠自己的文字，背景再冒出 AI 文字会打架；而且上方货架偏满，略挤弹幕带。
  整体更像「摆拍商拍」而不是「直播临场」，还带一点环形灯的绿色反光。

**MiniMax H3 —— 本轮失败（可定位、非算力问题）。**
- 基础设施打通了：torch 2.7（见下）后 ComfyUI 正常 `import`，98 s 起服务，原生 H3 节点在位，
  fl2va 剪枝 DiT + Qwen3-VL 文本编码 + VAE 都已下载到位、单卡 48GB 装得下。
- 失败在**我的图连错了**：`gen.py` 的通用 `discover()` 把节点选错——
  `h3_t2v` 命中了 `ComfyCloudMiniMaxH3FirstLastFrameToVideoNode`（Comfy Cloud 的 API/合作节点，且是首尾帧版，不是本地文生视频），
  `empty_latent` 选成了 `EmptyMiniMaxMusic3LatentAudio`（音乐，不是视频，应为 `EmptyMiniMaxH3LatentAV`），
  文本编码选成 `CLIPTextEncodeFlux`，`clip` 加载器空（文本编码器没落在它列的目录里）。
  最终 ComfyUI 报 `SaveVideo: Required input is missing: video`——`SaveVideo` 收的是 VIDEO 类型，需要先 `CreateVideo(images→video)`，
  我的图直接把 `images` 接进去了。两段都卡在校验（400），没进采样，所以没出画面。
- 这是**连图的 bug，不是模型能力或预算问题**；要跑通需按原生 H3 文生视频图重接：
  `EmptyMiniMaxH3LatentAV` + 本地 `MiniMaxH3*` 采样路径（`MiniMaxH3SigmaShift` 等）+ `CreateVideo`→`SaveVideo`，
  文本编码器放进 `text_encoders/` 并用对应 CLIP 加载器。预估再跑一次 ~40 min / ≈US$3，预算充足。

## 推荐（stage B）

1. **主力用 LTX-2.5**：直播临场感最强、无文字鬼影、显存最低（24.6GB，可用更小的卡）、每段最快（常驻单次加载后几分钟一段），
   和 08 的结论一致，`ai/ltx` 一套脚本可直接扩到六镜 × 三商品 × {16:9,1:1}。
2. **Wan 2.2 作补充**：需要「产品大特写、细节更足」的镜头（如 `cart` 的产品硬广感）可切 Wan；
   但必须解决背景文字鬼影——换支持负提示的 Wan 推理路径，或在提示里强化「plain unlabeled boxes, no text」，
   并把货架往虚化/下压，给弹幕带让位。
3. **MiniMax H3 暂不进 stage B**：基础设施已验证可跑，但需要把原生 H3 文生视频图接对（上面已列出确切改法）。
   若后续要三选一的完整画质对比，按该改法单跑一次即可，不阻塞 stage B 用 LTX 推进。

## 复现

```bash
# 从 opus-5.5/ 运行；每台实例都带 --hours 关机期限并在 EXIT 时 down；HF token 用完即删。
bash .scratch/10ai-ltx.sh       # LTX：g6e.2xlarge，setup→gen（room+cart 16:9）→pull→down
bash .scratch/10ai-wan.sh       # Wan：g6e.2xlarge，ti2v-5B
bash .scratch/10ai-minimax.sh   # MiniMax：g6e.4xlarge，ComfyUI 原生（图待修）
```

- 画面/帧按仓库规则不入 git（`*/out/`）；入 git 的只有 `ai/shots.json`、`ai/bakeoff.json`、各模型的 `setup`/`gen` 脚本和本报告。
- 分镜：`../../docs/specs/2026-10-08-10-live-flash-sale-storyboard.md`（分镜第 I 节「不出主播」是针对**代码版**；
  AI 变体按 10-ai-brief 的决定**让主播出镜**，因为代码建模的人偏 Q 版）。
