#!/usr/bin/env bash
# gen.sh — generate both bakeoff shots with Wan 2.2 TI2V-5B, measure speed/VRAM,
# extract PNG frames, and write timing.json. Run via cloud.mjs run from ~/showcase.
#
# Outputs land in ~/showcase/08-parcel-journey/out/ai/wan/ so `cloud.mjs pull
# 08-parcel-journey` brings them back.
#
# NOTE on the negative prompt: Wan2.2 generate.py (this revision) has NO
# --negative_prompt / --neg_prompt CLI flag (confirmed via --help). The negative
# prompt is a fixed internal config default (sample_neg_prompt in wan/configs).
# The bakeoff.json negative prompt therefore CANNOT be injected via CLI; this is
# recorded as a warning in timing.json rather than silently dropped.
set -euxo pipefail

export PATH="$HOME/.local/bin:$PATH"
WAN_HOME="$HOME/wan"
CKPT="$HOME/models/Wan2.2-TI2V-5B"
WAN_REPO="$WAN_HOME/Wan2.2"
# shellcheck disable=SC1091
source "$WAN_HOME/venv/bin/activate"

SHOWCASE="$HOME/showcase"
BAKEOFF="$SHOWCASE/08-parcel-journey/ai/bakeoff.json"
OUT="$SHOWCASE/08-parcel-journey/out/ai/wan"
mkdir -p "$OUT"

SIZE="1280*704"
FRAMES=121
FPS=24
SEED=1111

GPU_NAME="$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"

# Background VRAM sampler: logs memory.used (MiB) every 2s to a file.
start_vram_sampler() {
  local f="$1"
  ( while true; do nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1; sleep 2; done ) > "$f" &
  echo $!
}
peak_vram() { awk 'BEGIN{m=0}{if($1+0>m)m=$1+0}END{print m}' "$1"; }

cd "$WAN_REPO"

run_shot() {
  local id="$1" prompt="$2"
  local raw="$OUT/${id}_raw.mp4"
  local final="$OUT/${id}.mp4"
  local vramf="$OUT/${id}.vram.log"
  local runlog="$OUT/${id}.gen.log"
  echo "=== generating shot: $id ==="

  local sampler; sampler="$(start_vram_sampler "$vramf")"
  local t0 t1
  t0="$(date +%s.%N)"

  # ti2v-5B, single GPU, CPU offload + fp conversion + T5 on CPU to fit 24GB.
  # No negative-prompt flag exists; default internal negative prompt is used.
  # sample_steps left at the task default (not passed) and read back from the log.
  python generate.py \
    --task ti2v-5B \
    --size "$SIZE" \
    --frame_num "$FRAMES" \
    --ckpt_dir "$CKPT" \
    --offload_model True \
    --convert_model_dtype \
    --t5_cpu \
    --base_seed "$SEED" \
    --save_file "$raw" \
    --prompt "$prompt" 2>&1 | tee "$runlog"

  t1="$(date +%s.%N)"
  kill "$sampler" 2>/dev/null || true

  local gen_s peak steps
  gen_s="$(python -c "print(round($t1-$t0,1))")"
  peak="$(peak_vram "$vramf")"
  # Wan logs "sampling_steps" / "sample_steps" at generation start.
  steps="$(grep -oiE 'sampl[a-z_]*steps[^0-9]*[0-9]+' "$runlog" | grep -oE '[0-9]+' | head -1 || true)"
  echo "$id generation wall-clock: ${gen_s}s  peak VRAM: ${peak} MiB  steps: ${steps:-?}"

  # Re-encode to clean h264 yuv420p (broad compatibility) at 24fps.
  ffmpeg -y -i "$raw" -c:v libx264 -pix_fmt yuv420p -r "$FPS" -crf 18 "$final"

  # 4 PNG frames at 0.5s, 1.5s, 3.0s, 4.5s.
  local i=1
  for t in 0.5 1.5 3.0 4.5; do
    ffmpeg -y -ss "$t" -i "$final" -frames:v 1 "$OUT/${id}_f${i}.png"
    i=$((i+1))
  done

  printf '%s\n%s\n%s\n' "$gen_s" "$peak" "${steps:-}" > "$OUT/.${id}.timing"
}

# ---- model-load / torch import probe (recorded, not the full pipeline load) ----
LOAD_T0="$(date +%s.%N)"
python - <<'PY' || true
import time,sys
t=time.time()
import torch  # noqa
sys.stderr.write(f"torch import {time.time()-t:.1f}s\n")
PY
LOAD_T1="$(date +%s.%N)"
IMPORT_S="$(python -c "print(round($LOAD_T1-$LOAD_T0,1))")"

ROAST_PROMPT="$(python - <<PY
import json
print(json.load(open("$BAKEOFF"))["shots"][0]["prompt"])
PY
)"
POUR_PROMPT="$(python - <<PY
import json
print(json.load(open("$BAKEOFF"))["shots"][1]["prompt"])
PY
)"

run_shot roast "$ROAST_PROMPT"
run_shot pourover "$POUR_PROMPT"

# ---- assemble timing.json ----
REGION="${AWS_REGION:-unknown}"
ITYPE="${OPUS55_ITYPE:-unknown}"
read ROAST_S ROAST_V ROAST_STEPS < <(tr '\n' ' ' < "$OUT/.roast.timing"; echo)
read POUR_S POUR_V POUR_STEPS   < <(tr '\n' ' ' < "$OUT/.pourover.timing"; echo)

# model load seconds: time from generation start to first denoising step is not
# separable from the CLI; we approximate full model-load as (first-shot wall
# clock minus a per-shot sampling estimate is unreliable), so we record the
# measured per-shot wall clock and the torch import probe, and extract any
# explicit model-load timing Wan prints into the log if present.
LOAD_FROM_LOG="$(grep -oiE 'load[a-z _]*model[^0-9]*[0-9.]+ ?s' "$OUT/roast.gen.log" 2>/dev/null | grep -oE '[0-9.]+' | head -1 || true)"

python - <<PY
import json
rv=float("$ROAST_V" or 0); pv=float("$POUR_V" or 0)
steps=None
for s in ("$ROAST_STEPS","$POUR_STEPS"):
    s=s.strip()
    if s.isdigit(): steps=int(s); break
d = {
  "region": "$REGION",
  "instance_type": "$ITYPE",
  "gpu": "$GPU_NAME",
  "model": "Wan-AI/Wan2.2-TI2V-5B",
  "precision_offload": {
    "convert_model_dtype": True,
    "offload_model": True,
    "t5_cpu": True,
    "attention": "SDPA (flash_attn unavailable on A10G)"
  },
  "steps": steps,
  "steps_note": "ti2v-5B default sample_steps (not overridden); read from gen log",
  "sample_solver": "unipc (default)",
  "resolution": "1280x704",
  "frames": $FRAMES,
  "fps": $FPS,
  "seconds_target": 5,
  "torch_import_seconds": float("$IMPORT_S"),
  "model_load_seconds_from_log": (float("$LOAD_FROM_LOG") if "$LOAD_FROM_LOG" else None),
  "per_clip_generation_seconds": {"roast": float("$ROAST_S" or 0), "pourover": float("$POUR_S" or 0)},
  "peak_vram_mb": max(rv, pv),
  "per_clip_peak_vram_mb": {"roast": rv, "pourover": pv},
  "warnings": [
    "generate.py has no --negative_prompt flag; bakeoff.json negative prompt could NOT be applied via CLI (Wan uses its fixed internal sample_neg_prompt).",
    "flash_attn unavailable on A10G; used PyTorch SDPA attention.",
    "per_clip_generation_seconds is total CLI wall clock (includes per-shot model (re)load under --offload_model, not pure sampling)."
  ]
}
json.dump(d, open("$OUT/timing.json","w"), indent=2)
print(json.dumps(d, indent=2))
PY

echo "=== gen.sh done; outputs in $OUT ==="
ls -la "$OUT"
