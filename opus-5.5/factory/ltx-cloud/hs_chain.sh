#!/usr/bin/env bash
# headset all-AI chain on a fresh instance: NVMe venv + weights, then generate headset's 7 shots.
# HF_TOKEN from env.
export PATH="$HOME/.local/bin:$PATH"
export HF_HOME=/opt/dlami/nvme/hf HF_HUB_DISABLE_XET=1 UV_CACHE_DIR=/opt/dlami/nvme/uvcache
mkdir -p /opt/dlami/nvme/hf /opt/dlami/nvme/uvcache /opt/dlami/nvme/models/ltx-2.5
LTX=/opt/dlami/nvme/ltxsrc
MODELS=/opt/dlami/nvme/models/ltx-2.5
# ~/models + ~/ltx symlinks so beans-gen.py (uses ~/models, ~/ltx) finds NVMe
[ -L "$HOME/models" ] || { rmdir "$HOME/models" 2>/dev/null; ln -sfn /opt/dlami/nvme/models "$HOME/models"; }

# 1. clone + venv on NVMe
if [ ! -d "$LTX/.git" ]; then git clone --depth 1 https://github.com/Lightricks/LTX-2.git "$LTX"; fi
cd "$LTX"
uv sync --extra natten
echo "[hs] venv ready"

# 2. weights to NVMe
cd "$LTX"
uv run hf auth login --token "$HF_TOKEN" --add-to-git-credential || true
for f in \
  diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors \
  text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors \
  vae/ltx-2.5-video-vae-bf16.safetensors \
  vae/ltx-2.5-audio-vae-bf16.safetensors \
  latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors ; do
  [ -s "$MODELS/$f" ] && { echo "[hs] skip $f"; continue; }
  echo "[hs] downloading $f"
  uv run hf download Lightricks/LTX-2.5 "$f" --local-dir "$MODELS"
done
echo "[hs] weights ready"

# 3. generate headset (7 shots x 2 ar)
GEN_SHOTS="headset-shots.json" GEN_OUT="headset" GEN_FORCE=1 uv run python "$HOME/showcase/08-parcel-journey/ai/beans-gen.py" && echo HS_GEN_OK || echo HS_GEN_FAIL
echo HS_CHAIN_DONE
