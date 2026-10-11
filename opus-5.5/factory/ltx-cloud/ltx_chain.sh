#!/usr/bin/env bash
# Self-driving chain on the instance: 10 gen (weights already downloading in weights10.log),
# then 08 weights+gen. HF_TOKEN from env. All on NVMe. No monitor dependency.
export PATH="$HOME/.local/bin:$PATH"
export HF_HOME=/opt/dlami/nvme/hf HF_HUB_DISABLE_XET=1 UV_CACHE_DIR=/opt/dlami/nvme/uvcache
MODELS=/opt/dlami/nvme/models/ltx-2.5
cd /opt/dlami/nvme/ltxsrc

# 1. wait for the 5 weight files to finish (poll weights10.log for WEIGHTS10_OK)
echo "[chain] waiting for weights..."
for i in $(seq 1 120); do
  grep -q WEIGHTS10_OK /opt/dlami/nvme/weights10.log 2>/dev/null && break
  sleep 20
done
grep -q WEIGHTS10_OK /opt/dlami/nvme/weights10.log 2>/dev/null || { echo "[chain] weights FAILED"; exit 1; }
echo "[chain] weights OK, running 10 gen"

# 2. film 10 gen-all
uv run python "$HOME/showcase/10-live-flash-sale/ai/ltx/gen-all.py" && echo GEN10_DONE || { echo "[chain] gen10 FAILED"; exit 1; }

# 3. film 08 gen-all (same weights, same venv) — find its generator script
G08="$HOME/showcase/08-parcel-journey/ai/ltx/gen-all.py"
[ -f "$G08" ] || G08="$HOME/showcase/08-parcel-journey/ai/ltx/gen.py"
echo "[chain] running 08 gen: $G08"
uv run python "$G08" && echo GEN08_DONE || echo "[chain] gen08 FAILED"
echo CHAIN_DONE
