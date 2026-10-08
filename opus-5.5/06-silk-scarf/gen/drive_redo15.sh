#!/bin/bash
# drive_redo15.sh — 重跑 15 个镜头：丢失的 11 条 + 4 条重写提示词的瑕疵（dh_fly dh_drape sj_weave sj_lift）。
# 每条一个独立 Python 进程（跑完即退出释放 host RAM）+ 23G swap + MemoryMax=infinity 下稳定。
# gen_batch.py 断点续跑：已有 out/<id>_last.png 的镜头 ONLY 命中也 SKIP。
# 本地侧另有轮询器每条即时 rsync 回本地（防 NVMe 擦除再丢片）。
set -u
cd /opt/dlami/nvme/ltx-src
export HF_TOKEN=$(cat .hftok)
export HF_HOME=/opt/dlami/nvme/hf
export STEPS=24
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
PY=/opt/dlami/nvme/ltx/venv/bin/python

# 8 个剩余镜头（第二次 NVMe 擦除后）：qh_hero + yunhe 全5 + songjin 二改补跑 sj_weave sj_lift
SHOTS="sj_weave sj_lift qh_hero yh_dusk yh_crane yh_glide yh_land yh_hero"

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
  echo "DRIVE: $sid pass done -> $(ls out/*_last.png 2>/dev/null | wc -l) last-PNGs on box"
done
echo "DRIVE_REDO15_DONE last-PNGs on box = $(ls out/*_last.png 2>/dev/null | wc -l)"
