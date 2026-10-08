#!/usr/bin/env bash
# setup.sh — provision Wan 2.2 TI2V-5B on a single 24GB-GPU AWS instance.
# AMI: AWS Deep Learning Base OSS Nvidia Driver GPU (Ubuntu 24.04), no PyTorch.
# Idempotent: safe to re-run; marks completion with ~/wan/.setup-done.
# Everything (venv, repo clone, model weights) lives OUTSIDE ~/showcase so repo
# rsync (cloud.mjs sync) never clobbers it.
set -euxo pipefail

WAN_HOME="$HOME/wan"            # uv venv + Wan2.2 repo clone live here
MODELS="$HOME/models"           # HF weights
CKPT="$MODELS/Wan2.2-TI2V-5B"
LOG="$WAN_HOME/setup.log"

mkdir -p "$WAN_HOME" "$MODELS"
exec > >(tee -a "$LOG") 2>&1
echo "=== setup.sh starting $(date -u) ==="

nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || true

# --- uv (fast Python package manager), installs to ~/.local/bin ---
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"

# --- Python venv (3.11) ---
if [ ! -d "$WAN_HOME/venv" ]; then
  uv venv --python 3.11 "$WAN_HOME/venv"
fi
# shellcheck disable=SC1091
source "$WAN_HOME/venv/bin/activate"
UVPIP="uv pip"

# --- clone Wan2.2 (outside showcase) ---
if [ ! -d "$WAN_HOME/Wan2.2" ]; then
  git clone --depth 1 https://github.com/Wan-Video/Wan2.2.git "$WAN_HOME/Wan2.2"
fi

# --- PyTorch (CUDA 12.4 wheels) then repo requirements ---
# torch>=2.4 per task note. cu124 matches the DLAMI driver line.
$UVPIP install --python "$WAN_HOME/venv/bin/python" \
  torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124

# Install Wan2.2 requirements but DO NOT hard-fail if flash_attn can't build.
# flash_attn is optional — Wan falls back to PyTorch SDPA attention.
cd "$WAN_HOME/Wan2.2"
# Strip flash_attn from requirements; attempt it separately (allowed to fail).
grep -viE '^\s*flash[-_]attn' requirements.txt > /tmp/wan-reqs.txt || cp requirements.txt /tmp/wan-reqs.txt
$UVPIP install --python "$WAN_HOME/venv/bin/python" -r /tmp/wan-reqs.txt
# einops is imported by wan/modules but is missing from Wan2.2 requirements.txt
# (normally pulled transitively); install it explicitly so clean runs work.
# wan/__init__.py eagerly imports ALL task modules (s2v, animate), so their
# deps (decord, librosa, peft) must be present even for the ti2v-5B task.
$UVPIP install --python "$WAN_HOME/venv/bin/python" einops decord librosa peft
$UVPIP install --python "$WAN_HOME/venv/bin/python" "huggingface_hub[cli]"

# Optional flash-attn (prebuilt wheel if available; never block setup on it).
set +e
$UVPIP install --python "$WAN_HOME/venv/bin/python" flash-attn --no-build-isolation
FA_STATUS=$?
set -e
if [ $FA_STATUS -ne 0 ]; then
  echo "WARN: flash-attn install failed (status $FA_STATUS); will use SDPA fallback."
fi

# --- SDPA fallback patch ---------------------------------------------------
# Wan2.2 wan/modules/model.py imports flash_attention() DIRECTLY and that
# function hard-asserts FLASH_ATTN_2_AVAILABLE. The sibling attention() wrapper
# already falls back to torch SDPA when flash-attn is absent (true on A10G/L4),
# so alias the import to attention(). Idempotent (grep-guarded).
MODEL_PY="$WAN_HOME/Wan2.2/wan/modules/model.py"
if grep -q '^from \.attention import flash_attention$' "$MODEL_PY"; then
  sed -i 's/^from \.attention import flash_attention$/from .attention import attention as flash_attention/' "$MODEL_PY"
  echo "patched model.py: flash_attention -> attention (SDPA fallback)"
fi

# --- download weights to ~/models ---
if [ ! -f "$CKPT/.hf-done" ]; then
  hf download Wan-AI/Wan2.2-TI2V-5B --local-dir "$CKPT"
  touch "$CKPT/.hf-done"
fi

python - <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda, "avail", torch.cuda.is_available())
if torch.cuda.is_available():
    print("gpu", torch.cuda.get_device_name(0))
try:
    import flash_attn  # noqa
    print("flash_attn", flash_attn.__version__)
except Exception as e:
    print("flash_attn NOT available ->", type(e).__name__, "(SDPA fallback)")
PY

touch "$WAN_HOME/.setup-done"
echo "=== setup.sh done $(date -u) ==="
