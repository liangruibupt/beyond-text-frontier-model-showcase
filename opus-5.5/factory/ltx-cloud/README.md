# ltx-cloud — LTX-2.5 生成脚本（在 GPU 实例上跑）

方式二（模型生成视频）用到的实例端脚本：在 `factory/cloud.mjs` 开的 g6e 实例上装 LTX-2.5、下权重、批量出 AI 镜头帧。
完整流程（开机、提示词规律、后期、上画廊）见 [`../../docs/method2-ltx-video-workflow.md`](../../docs/method2-ltx-video-workflow.md)。

全部装在实例的 NVMe（`/opt/dlami/nvme`）：LTX 源码 `ltxsrc/`、uv venv、HF 缓存、权重 `models/ltx-2.5/`。
`HF_TOKEN` 只从环境变量读，脚本里不存任何凭证。

| 脚本 | 做什么 |
|---|---|
| `ltx10_setup.sh` | 克隆 LTX-2 + `uv sync`，检查 CUDA |
| `ltx10_weights.sh` | 下载 5 个 LTX-2.5 distilled 权重（已有则跳过） |
| `ltx10_gen.sh` | 10 直播秒杀：跑 `10-live-flash-sale/ai/ltx/gen-all.py` |
| `ltx_chain.sh` | 一条龙：等权重下完 → 10 生成 → 08 生成（不依赖外部监控） |
| `gen08_chain.sh` | 08：lantern / beans / headset 三件依次跑 `08-parcel-journey/ai/beans-gen.py`（`GEN_SHOTS` / `GEN_OUT`） |
| `hs_chain.sh` | 新实例从零：venv + 权重 + headset 七镜整片 AI |

## 用法

```bash
cd opus-5.5
export AWS_REGION=ap-northeast-1 OPUS55_INSTANCE=opus55-ltx   # 独立实例名，避免多个会话互相 rsync --delete
node factory/cloud.mjs up --type g6e.2xlarge --hours 3
# 脚本 scp 上去后用 bash 跑（比 ssh + heredoc 稳），HF_TOKEN 在实例上导出
scp -F ~/.ssh/$OPUS55_INSTANCE.config factory/ltx-cloud/hs_chain.sh $OPUS55_INSTANCE:
ssh -F ~/.ssh/$OPUS55_INSTANCE.config $OPUS55_INSTANCE 'HF_TOKEN=… nohup bash hs_chain.sh > hs.log 2>&1 &'
# 帧在实例的 showcase/<film>/out/ai/<item>/frames/；拉回后 render，完事立刻 down
node factory/cloud.mjs pull 08-parcel-journey
node factory/cloud.mjs down
```

注意：生成好的帧在 `<film>/out/ai/` 下，被 `.gitignore` 忽略且没有别的备份，重新生成要再跑一遍 GPU。
另外 `cloud.mjs` 的代码同步排除 `*/out/`，经 SSM 隧道推帧只有约 0.5 MB/s（08 的 2.6 GB 约 80 分钟），出片前先算好时间。
