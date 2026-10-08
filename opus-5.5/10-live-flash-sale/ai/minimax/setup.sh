#!/usr/bin/env bash
# setup.sh — provision MiniMax-H3 (open weights) under ComfyUI on a single 48GB-GPU AWS instance (g6e L40S).
# AMI: AWS Deep Learning Base OSS Nvidia Driver GPU (Ubuntu 24.04). Runs ON the instance via cloud.mjs run.
# Everything lives OUTSIDE ~/showcase so repo rsync never clobbers it:
#   ComfyUI + venv -> ~/comfy/ComfyUI       weights -> ~/comfy/ComfyUI/models/{diffusion_models,text_encoders,vae}
#
# We use ComfyUI's NATIVE MiniMax-H3 support (v0.30+): the Comfy-Org repackage ships a single-file DiT, the
# Qwen3-VL text encoder and the video+audio VAEs ready for the stock loaders — no multishot node pack needed
# for a single text-to-video clip. We fetch a PRUNED / quantised DiT so it fits one L40S (48GB) with ComfyUI
# streaming any overflow. HF_TOKEN (if present) is used for the gated MiniMax community license repo.
# Idempotent: marks ~/comfy/.setup-done.
set -euxo pipefail

COMFY="$HOME/comfy/ComfyUI"
MODELS="$COMFY/models"
LOG="$HOME/comfy/setup.log"
mkdir -p "$HOME/comfy"
exec > >(tee -a "$LOG") 2>&1
echo "=== minimax setup starting $(date -u) ==="
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || true

export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then curl -LsSf https://astral.sh/uv/install.sh | sh; fi

# --- ComfyUI (master = has native MiniMax-H3) + a torch NEW ENOUGH for its comfy_kitchen backend ---
# The first bake-off attempt failed at `import comfy.utils`: comfy_kitchen's eager conv3d registers a
# torch.library.custom_op whose `stride: list[int]` (PEP 585) parameter is rejected by torch's
# infer_schema on torch<2.7 ("Parameter stride has unsupported type list[int]"). The fix is a NEWER
# torch, not an older ComfyUI: torch 2.7+ accepts bare list[int] in custom_op schema inference.
if [ ! -d "$COMFY/.git" ]; then
  git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "$COMFY"
fi
cd "$COMFY"
if [ ! -d "$COMFY/.venv" ]; then
  uv venv --python 3.12 "$COMFY/.venv"
fi
# torch 2.7.x cu128 wheels (newer than the 2.6 that broke comfy_kitchen's custom_op schema inference).
uv pip install --python "$COMFY/.venv/bin/python" "torch>=2.7" torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install --python "$COMFY/.venv/bin/python" -r requirements.txt
# Verify the import actually works BEFORE spending download time; fail setup loudly if not.
"$COMFY/.venv/bin/python" -c "import torch; print('torch', torch.__version__); import comfy.utils; print('comfy import OK')" || { echo "COMFY_IMPORT_FAIL"; exit 1; }

PY="$COMFY/.venv/bin/python"
"$PY" -c "import torch;print('torch',torch.__version__,'cuda',torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no-gpu')"
"$PY" -c "import comfy; print('comfy import ok')" || true

# --- HF auth (MiniMax community-license repo may be gated) ---
uv pip install --python "$PY" "huggingface_hub[cli]"
export PATH="$HOME/.local/bin:$PATH"
if [ -n "${HF_TOKEN:-}" ]; then
  "$COMFY/.venv/bin/hf" auth login --token "$HF_TOKEN" --add-to-git-credential || true
fi

mkdir -p "$MODELS/diffusion_models" "$MODELS/text_encoders" "$MODELS/vae"
dl() {  # dl <repo> <repo-relative-path> <dest-subdir>
  local repo="$1" f="$2" sub="$3"
  local base; base="$(basename "$f")"
  if [ -s "$MODELS/$sub/$base" ]; then echo "already have $sub/$base"; return 0; fi
  "$COMFY/.venv/bin/hf" download "$repo" "$f" --local-dir /tmp/h3dl
  mv "/tmp/h3dl/$f" "$MODELS/$sub/$base"
}

# Comfy-Org repackage — pick the PRUNED int8 ref2va/fl2va DiT (fits 48GB), the Qwen3-VL encoder, the VAEs.
# File names resolved on the instance from the repo tree (setup prints the tree first so a rename is visible).
echo "=== Comfy-Org/MiniMax-H3 tree ==="
"$COMFY/.venv/bin/hf" download Comfy-Org/MiniMax-H3 --include "*.txt" --local-dir /tmp/h3tree 2>/dev/null || true
"$COMFY/.venv/bin/python" - <<'PY'
from huggingface_hub import HfApi
api = HfApi()
for f in api.list_repo_files("Comfy-Org/MiniMax-H3"):
    print(f)
PY

# DiT: prefer a pruned/quantised fl2va or ref2va single-file (text-to-video capable). gen.py picks whichever landed.
# These names match the Comfy-Org repackage as of 2026-10; setup is tolerant — it downloads the first that exists.
for CAND in \
  "diffusion_models/minimax_h3_fl2va_pruned_w6a8.safetensors" \
  "diffusion_models/minimax_h3_ref2va_pruned_w6a8.safetensors" \
  "diffusion_models/minimax_h3_fl2va_int8_convrot.safetensors" ; do
  if "$COMFY/.venv/bin/python" - "$CAND" <<'PY'
import sys
from huggingface_hub import HfApi
f=sys.argv[1]
sys.exit(0 if f in set(HfApi().list_repo_files("Comfy-Org/MiniMax-H3")) else 1)
PY
  then dl Comfy-Org/MiniMax-H3 "$CAND" diffusion_models; break; fi
done

# Text encoder (Qwen3-VL) and the two VAEs — download whatever the repo exposes under those dirs.
"$COMFY/.venv/bin/python" - <<'PY'
import subprocess, sys
from huggingface_hub import HfApi
import os
MODELS=os.path.expanduser("~/comfy/ComfyUI/models")
HF=os.path.expanduser("~/comfy/ComfyUI/.venv/bin/hf")
files=HfApi().list_repo_files("Comfy-Org/MiniMax-H3")
want=[("text_encoders/","text_encoders"),("vae/","vae")]
for pref,sub in want:
    for f in files:
        if f.startswith(pref) and f.endswith(".safetensors"):
            base=os.path.basename(f); dest=f"{MODELS}/{sub}/{base}"
            if os.path.exists(dest) and os.path.getsize(dest)>0:
                print("have",sub,base); continue
            subprocess.run([HF,"download","Comfy-Org/MiniMax-H3",f,"--local-dir","/tmp/h3dl"],check=True)
            os.replace(f"/tmp/h3dl/{f}",dest); print("got",sub,base)
PY

echo "=== models on disk ==="
du -sh "$MODELS"/*/* 2>/dev/null | tail -20 || true
df -h "$HOME"
touch "$HOME/comfy/.setup-done"
echo "SETUP_OK"
