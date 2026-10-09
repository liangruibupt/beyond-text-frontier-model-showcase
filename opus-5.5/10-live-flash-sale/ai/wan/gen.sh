#!/usr/bin/env bash
# gen.sh — Wan 2.2 bake-off for film 10 (lantern room + cart, 16:9).
# Runs ON the GPU instance. Reuses ~/wan (venv + Wan2.2 clone) from setup.sh.
#   bash ~/showcase/10-live-flash-sale/ai/wan/gen.sh
#
# Strategy (per 08 REPORT): TI2V-5B fits a 48GB L40S comfortably (official target is 24GB).
# We try A14B T2V first ONLY if WAN_TASK=t2v-A14B is set AND the card is >=48GB with offload;
# default is ti2v-5B (safe, Apache-2.0, no gating). generate.py in this revision has no
# --negative CLI, so the bake-off negative is NOT applied (internal default used) — recorded.
# Size 1280*704, 73 frames (4k+1 legal on Wan's 4x temporal VAE), seed 1111.
# Picture-only: Wan output is silent already; we still -an on re-encode for parity.
set -u
export PATH="$HOME/.local/bin:$PATH"
WAN_HOME="$HOME/wan"
REPO="$WAN_HOME/Wan2.2"
CKPT="$HOME/models/Wan2.2-TI2V-5B"
SHOWCASE="$HOME/showcase"
AI="$SHOWCASE/10-live-flash-sale/ai"
OUT="$SHOWCASE/10-live-flash-sale/out/ai/wan"
FRAMES="$OUT/frames"; CONTACT="$OUT/contact"
mkdir -p "$OUT" "$FRAMES" "$CONTACT"
source "$WAN_HOME/venv/bin/activate"

SEED=$(python -c "import json;print(json.load(open('$AI/bakeoff.json'))['seed'])")
NFR=$(python -c "import json;print(json.load(open('$AI/bakeoff.json'))['frame_grids']['wan'])")
GPU=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
TIMING="$OUT/timing.json"
echo "{\"model\":\"Wan 2.2 TI2V-5B\",\"region\":\"${AWS_REGION:-unknown}\",\"instance_type\":\"${WAN_INSTANCE_TYPE:-unknown}\",\"gpu\":\"$GPU\",\"fps\":24,\"seed\":$SEED,\"num_frames\":$NFR,\"resolution\":\"1280x704\",\"notes\":[\"generate.py has no --negative CLI; internal default used\",\"TI2V-5B single DiT; 50 steps default\"],\"clips\":{" > "$TIMING"

peak_watch() {  # background: write peak MB to $1
  local pf="$1"; echo 0 > "$pf"
  while true; do
    u=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | sort -n | tail -1)
    p=$(cat "$pf"); [ "$u" -gt "$p" ] && echo "$u" > "$pf"
    sleep 0.5
  done
}

FIRST=1; FAIL=0
for SID in room cart; do
  PROMPT=$(python -c "import json;d=json.load(open('$AI/shots.json'));s={x['id']:x for x in d['shots']}['$SID'];print(s['lantern']['16x9'])")
  KEY="${SID}_16x9"
  RAW="$OUT/_${KEY}.raw.mp4"; FINAL="$OUT/${KEY}.mp4"
  echo "=== wan $KEY $NFR f seed $SEED ==="
  PF=$(mktemp); peak_watch "$PF" & WATCH=$!
  T0=$(date +%s)
  set +e
  ( cd "$REPO" && python generate.py --task ti2v-5B --size "1280*704" --ckpt_dir "$CKPT" \
      --frame_num "$NFR" --base_seed "$SEED" --offload_model True --convert_model_dtype --t5_cpu \
      --prompt "$PROMPT" --save_file "$RAW" ) > "$OUT/${KEY}.log" 2>&1
  RC=$?
  set -e 2>/dev/null || true
  T1=$(date +%s); SECS=$((T1-T0))
  kill "$WATCH" 2>/dev/null || true; PEAK=$(cat "$PF"); rm -f "$PF"
  [ "$FIRST" -eq 1 ] || echo "," >> "$TIMING"; FIRST=0
  if [ $RC -eq 0 ] && [ -s "$RAW" ]; then
    ffmpeg -y -i "$RAW" -an -c:v libx264 -pix_fmt yuv420p -crf 16 "$FINAL" >/dev/null 2>&1
    mkdir -p "$FRAMES/$KEY"
    ffmpeg -y -i "$FINAL" "$FRAMES/$KEY/f%04d.png" >/dev/null 2>&1
    N=$(ls "$FRAMES/$KEY"/f*.png 2>/dev/null | wc -l | tr -d ' ')
    MID=$(ls "$FRAMES/$KEY"/f*.png | sed -n "$(( (N+1)/2 ))p"); cp "$MID" "$CONTACT/${KEY}.png"
    echo "\"$KEY\":{\"generation_seconds\":$SECS,\"peak_vram_mb\":$PEAK,\"frames_on_disk\":$N}" >> "$TIMING"
    echo "  ok: ${SECS}s peak ${PEAK}MB $N frames"
    rm -f "$RAW"
  else
    TAIL=$(tail -5 "$OUT/${KEY}.log" | tr '\n' ' ' | tr -d '"' | cut -c1-500)
    echo "\"$KEY\":{\"error\":\"rc=$RC: $TAIL\",\"generation_seconds\":$SECS,\"peak_vram_mb\":$PEAK}" >> "$TIMING"
    echo "  FAILED rc=$RC (see ${KEY}.log)"; FAIL=1
  fi
done
echo "}}" >> "$TIMING"
cat "$TIMING"
if [ $FAIL -eq 1 ]; then echo "GEN_PARTIAL"; exit 1; fi
echo "GEN_OK"
