#!/usr/bin/env bash
# setup.sh — install the official Lightricks LTX-2.5 inference code + distilled FP8 checkpoints
# on an AWS g6e (L40S 48GB) instance. Runs ON the instance via cloud.mjs run.
#
#   Everything lives OUTSIDE ~/showcase so rsync --delete never wipes it:
#     code    -> ~/ltx         (git clone of Lightricks/LTX-2, uv venv)
#     weights -> ~/models/ltx-2.5
#
# Idempotent: re-running skips clone/venv/downloads that already succeeded.
set -euxo pipefail

LTX_DIR="$HOME/ltx"
MODELS_DIR="$HOME/models/ltx-2.5"
REPO="https://github.com/Lightricks/LTX-2.git"

# --- 0. system deps: git-lfs, ffmpeg (already on AMI via showcase boot), uv ---
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"
command -v uv

# --- 1. clone the official repo ---
if [ ! -d "$LTX_DIR/.git" ]; then
  git clone --depth 1 "$REPO" "$LTX_DIR"
fi
cd "$LTX_DIR"

# --- 2. create the venv & install (natten extra = fastest diffusion-VAE backend, Linux+CUDA) ---
#   uv sync builds the project's locked environment under $LTX_DIR/.venv
#   --extra natten is the recommended backend for the diffusion video VAE decoder.
if [ ! -d "$LTX_DIR/.venv" ]; then
  uv sync --extra natten
else
  # ensure deps are present on a re-run without re-resolving unnecessarily
  uv sync --extra natten || true
fi

# print torch / cuda sanity
uv run python -c "import torch; print('torch', torch.__version__, 'cuda', torch.version.cuda, 'avail', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no-gpu')"

# --- 3. download the DISTILLED split checkpoints (only what DistilledPipeline needs) ---
#   transformer (distilled), text encoder (gemma4-12b, bundles projection+tokenizer),
#   video VAE (diffusion decoder, pairs with natten), audio VAE (pipeline generates audio;
#   we discard it in post), spatial upsampler.
#   HF token: read from env HF_TOKEN if the repo is gated; LTX-2.5 is public but may require login.
mkdir -p "$MODELS_DIR"
cd "$LTX_DIR"

if [ -n "${HF_TOKEN:-}" ]; then
  uv run hf auth login --token "$HF_TOKEN" --add-to-git-credential || true
fi

dl() {
  # $1 = repo-relative path. Skip if already present and non-empty.
  local f="$1"
  if [ -s "$MODELS_DIR/$f" ]; then
    echo "already have $f"
    return 0
  fi
  uv run hf download Lightricks/LTX-2.5 "$f" --local-dir "$MODELS_DIR"
}

dl diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors
dl text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors
dl vae/ltx-2.5-video-vae-bf16.safetensors
dl vae/ltx-2.5-audio-vae-bf16.safetensors
dl latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors

echo "=== weights on disk ==="
du -sh "$MODELS_DIR"/* 2>/dev/null || true
df -h "$HOME"
echo "SETUP_OK"
