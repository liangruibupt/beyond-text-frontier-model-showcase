#!/usr/bin/env bash
# Run film-10 LTX gen-all using the NVMe venv. HF_TOKEN from env.
set -e
export PATH="$HOME/.local/bin:$PATH"
export HF_HOME=/opt/dlami/nvme/hf
export HF_HUB_DISABLE_XET=1
export UV_CACHE_DIR=/opt/dlami/nvme/uvcache
cd /opt/dlami/nvme/ltxsrc
uv run python "$HOME/showcase/10-live-flash-sale/ai/ltx/gen-all.py"
echo GEN10_DONE
