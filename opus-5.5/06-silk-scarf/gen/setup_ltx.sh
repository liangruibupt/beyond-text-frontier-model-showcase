#!/bin/bash
# setup_ltx.sh — 在 GPU 实例上装 LTX-2.5 推理环境（方式二）。幂等：装过就跳过。
# 全部放在 NVMe（/opt/dlami/nvme）上：根盘只有 ~22G，LTX-2.5 权重有几十 G。
# 用法（在 GPU 实例上）：HF_TOKEN=... bash setup_ltx.sh
set -eux

NVME=/opt/dlami/nvme
WORK="$NVME/ltx"
VENV="$WORK/venv"
export HF_HOME="$NVME/hf"              # 模型权重缓存放 NVMe
export PIP_CACHE_DIR="$NVME/pipcache"
sudo mkdir -p "$WORK" "$HF_HOME" "$PIP_CACHE_DIR"
sudo chown -R "$(id -u):$(id -g)" "$NVME" 2>/dev/null || true
mkdir -p "$WORK" "$HF_HOME" "$PIP_CACHE_DIR"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
. "$VENV/bin/activate"
python -m pip install -q --upgrade pip wheel

# torch (CUDA 12.x wheels work on the L40S driver 595). diffusers from source for the LTX-2.5 (ltx2) pipeline.
python - <<'PY' || pip install -q "torch" "torchvision" --index-url https://download.pytorch.org/whl/cu124
import importlib.util, sys
sys.exit(0 if importlib.util.find_spec("torch") else 1)
PY
pip install -q "diffusers @ git+https://github.com/huggingface/diffusers.git" \
  "transformers>=4.44" "accelerate" "safetensors" "sentencepiece" "imageio[ffmpeg]" "pillow" "huggingface_hub[cli]"

echo "=== versions ==="
python - <<'PY'
import torch, diffusers, transformers
print("torch", torch.__version__, "cuda", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "-")
print("diffusers", diffusers.__version__, "transformers", transformers.__version__)
PY
echo "SETUP_OK"
