# Wan 2.2 TI2V-5B bake-off (opus-5.5 / 08-parcel-journey)

Same two `../bakeoff.json` shots as LTX (`roast`, `pourover`), on one 24 GB GPU.

**Status: FAILED — no clip produced.** See `../report/REPORT.md` for the comparison.

## Run (2026-10-02)

| Item | Value |
|---|---|
| Instance | g6.2xlarge, NVIDIA L4 24 GB, us-east-2 (g5/g6 xlarge were full in us-east-1) |
| Code | [Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2), `generate.py --task ti2v-5B` |
| Flags | `--offload_model True --convert_model_dtype --t5_cpu`, size `1280*704`, 121 frames, seed 1111, default 50 steps |
| Patch | `setup.sh` strips the hard `flash_attn` requirement and falls back to PyTorch SDPA when no flash-attn wheel installs |
| Negative prompt | Not passable: this revision of `generate.py` has no CLI flag; the internal default is used |

Timeline for `roast`: launch 15:07 UTC, boot + venv + weights until `generate.py`
started at 15:56 (~50 min); T5 prompt encode on CPU and model load, then 50
sampling steps at ~27.5 s/step ≈ 23 min; at 16:32 (~37 min after start)
**CUDA OOM in the VAE decoder** (`wan/modules/vae2_2.py` decode, 2.6 GiB
allocation with 1.5 GiB free of 22 GiB). `pourover` never started.

So on a 24 GB L4 the 5B model needs ~35 min per 5 s clip *before* decode, and
full-resolution decode does not fit. Possible fixes, not tried: tiled/chunked
VAE decode, lower resolution (e.g. 960x544), freeing the DiT before decode, or a
48 GB card — the latter removes the reason to pick Wan over LTX.

## Usage

```bash
# from opus-5.5/
AWS_REGION=us-east-2 OPUS55_INSTANCE=opus55-wan node factory/cloud.mjs up \
  --type g6.2xlarge,g5.2xlarge --disk 200 --hours 3
AWS_REGION=us-east-2 OPUS55_INSTANCE=opus55-wan node factory/cloud.mjs run bash 08-parcel-journey/ai/wan/setup.sh
AWS_REGION=us-east-2 OPUS55_INSTANCE=opus55-wan node factory/cloud.mjs run bash 08-parcel-journey/ai/wan/gen.sh
AWS_REGION=us-east-2 OPUS55_INSTANCE=opus55-wan node factory/cloud.mjs pull 08-parcel-journey
AWS_REGION=us-east-2 OPUS55_INSTANCE=opus55-wan node factory/cloud.mjs down
```

Outputs go to `08-parcel-journey/out/ai/wan/` (gitignored). No token is needed;
the weights are not gated.
