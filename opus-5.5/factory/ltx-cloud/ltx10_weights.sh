#!/usr/bin/env bash
# Download the 5 distilled LTX-2.5 checkpoints to NVMe. HF_TOKEN from env.
set -e
export PATH="$HOME/.local/bin:$PATH"
export HF_HOME=/opt/dlami/nvme/hf
export HF_HUB_DISABLE_XET=1
export UV_CACHE_DIR=/opt/dlami/nvme/uvcache
MODELS=/opt/dlami/nvme/models/ltx-2.5
mkdir -p "$MODELS"
cd /opt/dlami/nvme/ltxsrc
uv run hf auth login --token "$HF_TOKEN" --add-to-git-credential || true
for f in \
  diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors \
  text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors \
  vae/ltx-2.5-video-vae-bf16.safetensors \
  vae/ltx-2.5-audio-vae-bf16.safetensors \
  latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors ; do
  if [ -s "$MODELS/$f" ]; then echo "skip $f"; continue; fi
  echo "downloading $f"
  uv run hf download Lightricks/LTX-2.5 "$f" --local-dir "$MODELS"
done
du -sh "$MODELS"
echo WEIGHTS10_OK
