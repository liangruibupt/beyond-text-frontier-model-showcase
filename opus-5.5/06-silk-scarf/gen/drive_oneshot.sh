#!/bin/bash
# drive_oneshot.sh — 逐镜头跑 gen_batch.py，每条一个独立 Python 进程（跑完即退出释放 host RAM），
# 规避 g6e.2xlarge ~32GB host RAM 在 model-cpu-offload 跨镜头累积导致的 OOM-kill。
# gen_batch.py 自身断点续跑：已有 out/<id>_last.png 的镜头 ONLY 命中也会 SKIP。
set -u
cd /opt/dlami/nvme/ltx-src
export HF_TOKEN=$(cat .hftok)
export HF_HOME=/opt/dlami/nvme/hf
export STEPS=24
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
PY=/opt/dlami/nvme/ltx/venv/bin/python

# 全部 20 个唯一镜头 id（顺序 = prompts.json）
SHOTS="dh_cave dh_fly dh_ceiling dh_drape dh_hero sj_warp sj_weave sj_lift sj_fold sj_box qh_paint qh_bloom qh_slip qh_pool qh_hero yh_dusk yh_crane yh_glide yh_land yh_hero"

for sid in $SHOTS; do
  if [ -f "out/${sid}_last.png" ]; then
    echo "DRIVE: $sid already done, skip"
    continue
  fi
  echo "DRIVE: generating $sid …"
  ONLY="$sid" "$PY" gen_batch.py
  rc=$?
  if [ ! -f "out/${sid}_last.png" ]; then
    echo "DRIVE: $sid FAILED (rc=$rc, no PNG) — retry once"
    ONLY="$sid" "$PY" gen_batch.py
    [ -f "out/${sid}_last.png" ] || echo "DRIVE: $sid STILL FAILED after retry"
  fi
done
echo "DRIVE_ALL_DONE done=$(ls out/*_last.png 2>/dev/null | wc -l)/20"
