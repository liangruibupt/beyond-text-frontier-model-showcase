#!/usr/bin/env bash
# 08 AI generation: run the resident generator for lantern, beans, headset.
# Weights + venv already on NVMe (from 10's setup). HF_TOKEN from env.
export PATH="$HOME/.local/bin:$PATH"
export HF_HOME=/opt/dlami/nvme/hf HF_HUB_DISABLE_XET=1 UV_CACHE_DIR=/opt/dlami/nvme/uvcache
cd /opt/dlami/nvme/ltxsrc
G="$HOME/showcase/08-parcel-journey/ai/beans-gen.py"
for pair in "lantern-shots.json:lantern" "beans-shots.json:beans" "headset-shots.json:headset"; do
  SH="${pair%%:*}"; OUT="${pair#*:}"
  echo "=== [08] generating $OUT (GEN_SHOTS=$SH) ==="
  GEN_SHOTS="$SH" GEN_OUT="$OUT" uv run python "$G" && echo "GEN08_${OUT}_OK" || echo "GEN08_${OUT}_FAIL"
done
echo CHAIN08_DONE
