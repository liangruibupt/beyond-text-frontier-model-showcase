#!/usr/bin/env bash
# Install LTX-2 on NVMe (uv already present). HF token comes from env HF_TOKEN at run time.
set -e
export PATH="$HOME/.local/bin:$PATH"
export HF_HOME=/opt/dlami/nvme/hf
export HF_HUB_DISABLE_XET=1
export UV_CACHE_DIR=/opt/dlami/nvme/uvcache
mkdir -p /opt/dlami/nvme/hf /opt/dlami/nvme/uvcache
LTX=/opt/dlami/nvme/ltxsrc
if [ ! -d "$LTX/.git" ]; then
  git clone --depth 1 https://github.com/Lightricks/LTX-2.git "$LTX"
fi
cd "$LTX"
uv sync --extra natten
uv run python -c 'import torch;print("cuda", torch.cuda.is_available())'
echo SETUP10_OK
