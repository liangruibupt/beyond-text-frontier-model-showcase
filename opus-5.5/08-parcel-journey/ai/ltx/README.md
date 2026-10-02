# LTX-2.5 bake-off (opus-5.5 / 08-parcel-journey)

Benchmark the open-weights **LTX-2.5** video model (Lightricks) on **one** AWS g6e
GPU instance (NVIDIA **L40S 48 GB**): generate the two `bakeoff.json` text-to-video
shots (`roast`, `pourover`), measure speed and peak VRAM, pull the clips back, and
terminate the instance.

**Status: SUCCESS.** Both clips generated, pulled, and verified
(`ffprobe`: h264, 1280×704, 24 fps, 121 frames, 5.04 s, no audio). Instance
terminated.

---

## Model & pipeline

* **Repo / code:** [Lightricks/LTX-2](https://github.com/Lightricks/LTX-2) (the
  official `ltx-pipelines` package). LTX-2.5 is the recommended model there.
* **Pipeline:** `python -m ltx_pipelines.distilled` — **DistilledPipeline**, the
  fast two-stage path (stage 1 at half res, 2× latent upscale + refine). 8
  predefined sigmas (8 steps stage 1 + 4 steps stage 2).
* **Checkpoint:** `ltx-2.5-22b-distilled-transformer-bf16.safetensors` (~42 GB).
* **Precision:** `--quantization fp8-cast` — downcasts the bf16 checkpoint to FP8
  on the fly. L40S (Ada) has native FP8. Peak VRAM was ~25 GB, comfortably under 48.
* **Weights** (split, Comfy-aligned layout, into `~/models/ltx-2.5`, ~67 GB total):
  distilled transformer, `gemma4-12b-with-proj-ltx-2.5-bf16` text encoder (~26 GB),
  video VAE (diffusion decoder, pairs with the `natten` extra), audio VAE
  (generated audio is discarded), spatial upscaler.

### Settings used

| Setting | Value |
|---|---|
| Resolution | **1280 × 704** (both multiples of 64 → legal for the 2-stage path) |
| Frames | **121** — 5 s × 24 fps = 120, snapped up to the causal grid `8k+1`; clip is 5.04 s |
| Frame rate | 24 fps |
| Seed | 1111 |
| Quantization | `fp8-cast` |
| Offload | `none` |
| Negative prompt | **Not applied.** `ltx_pipelines.distilled` is the *unguided* (no-CFG) path and its CLI has **no `--negative-prompt`** (that flag exists only on the guided 1-/2-stage parsers). The `bakeoff.json` negative prompt could not be used on this model's fast path. |
| Audio | Discarded (`ffmpeg -an`); only the h264 picture is kept |

---

## Results

From `08-parcel-journey/out/ai/ltx/timing.json` (ap-northeast-1, g6e.xlarge, NVIDIA L40S):

| Clip | Wall-clock seconds (full subprocess) | Peak VRAM |
|---|---|---|
| roast (1st run, incl. model load) | 957.8 s | 25,627 MB |
| pourover (warm) | 924.6 s | 25,627 MB |
| roast (2nd run, steady-state) | 940.8 s | 25,627 MB |

**Read these numbers carefully — they are LOAD-bound, not compute-bound.** On a
`g6e.xlarge` the box has only **30 GB system RAM**, while the distilled transformer
is a **42 GB** `.safetensors`. The `fp8-cast` policy mmaps the whole file to read
its scale tensors and the loader then streams it in, so each run pages ~42 GB
through a **64 GB swap file on the EBS root** — that disk I/O is ~14–15 min and
dominates every run. The actual **GPU generation is seconds**: the pipeline logs
show stage-1 + stage-2 denoise at roughly 4–6 s/it over a dozen steps and the VAE
decode at ~11 it/s (sub-second). gen.py shells out once per clip, so each clip
re-pays the full load; that is why "warm" pourover is not meaningfully faster than
the cold roast. **To get a true per-clip generation time, run on a `g6e.2xlarge`
(64 GB RAM) or larger so the checkpoint stays resident** — load drops to one short
read and the three numbers above would collapse to tens of seconds each.

* Peak VRAM steady at **25,627 MB** (~25 GB of 48) across all runs — distilled +
  FP8 leaves comfortable headroom; `--offload` was not needed.
* No warnings emitted by the pipeline (`"warnings": []`).

### Visual quality assessment (my own eyeball of the PNGs)

**roast** — Excellent. A polished copper drum roaster fills the right of the frame
with a convincing round glass sight window; green/pale beans tumbling behind the
glass at frame 1 visibly darken toward chestnut by frame 3, so the *color-shift
over time* the prompt asked for actually happens. Warm amber key light from the
left, a soft-bokeh moody roastery background with a hanging lamp and faint smoke,
and a genuinely shallow depth of field focused on the beans. Copper reflections and
film grain read as live-action commercial footage. Minor artifacts: the beans are a
touch soft/mushy in the densest cluster and the background props are impressionistic
rather than crisp — normal for the distilled (fast) checkpoint. Prompt adherence:
very high.

**pourover** — Also excellent and arguably the stronger shot. Morning window light,
a white ceramic V60-style cone on a glass server on a light oak counter, a matte
black gooseneck kettle pouring a thin stream into the bed, with real steam curling
up through the backlit sunbeam and dark coffee visible dripping into the server
below. Cozy-kitchen bokeh (plant, jars, cabinetry) and shallow DoF are all present.
It reads as a believable café/lifestyle ad frame. Artifacts: the cone is a simplified
flat-sided dripper rather than a true ribbed V60, and the pour stream is a little
thick/stylized vs. the "thin spiral" wording — small prompt-adherence misses, no
deformed geometry or flicker in the sampled frames. Prompt adherence: high.

Overall: for an 8+4-step distilled FP8 model, both clips are clean, photoreal,
well-lit, and on-prompt, with no gross temporal artifacts in the sampled frames.
The honest caveat is that the distilled path trades the fine micro-detail
(individual bean/texture crispness, exact object geometry) that the full DFR path
would recover.

---

## Gated-repo / HF token requirement

`Lightricks/LTX-2.5` is a **gated** HF repo (`"gated": "auto"`). To download the
weights you need **both**:

1. An HF account that has clicked **"Agree and Access"** on the
   [model page](https://huggingface.co/Lightricks/LTX-2.5) (accepts the LTX-2.x
   Community License). Gating is `auto`, so the grant is instant. *Authenticating
   alone is not enough — before the license is accepted, metadata APIs return 200
   but every weight file returns `HTTP 403 "requires approval"`.*
2. An HF **Read** token from that same account (fine-grained tokens need the
   *"read gated repos"* scope).

**Token handling (mandatory):** never print, echo, `cat`, or log the token value,
and never write it into a repo file. Install it on the instance by expanding it
**locally** so the literal never appears in the command text. `huggingface_hub`
reads `~/.cache/huggingface/token` automatically; `setup.sh` relies on that file
(or the `HF_TOKEN` env var), never a hard-coded value. Delete the token file before
terminating.

```bash
# token lives in ~/.env as HF_TOKEN=... ; expand locally, write to the HF cache file
T=$(grep -E '^HF_TOKEN=' ~/.env | tail -1 | cut -d= -f2- | tr -d "\"' ") \
  && OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs run \
     bash -lc "umask 077; mkdir -p ~/.cache/huggingface; printf %s $T > ~/.cache/huggingface/token"
```

---

## Deploy & run (reproducible)

All commands run from `opus-5.5/`. Always prefix with `OPUS55_INSTANCE=opus55-ltx`
so this gets its own instance (never touch the sibling `opus55-wan` run). Keep the
**same `AWS_REGION`** for every command after `up`.

### 1. Launch the GPU instance

```bash
cd opus-5.5
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs up \
  --type g6e.xlarge,g6e.2xlarge --hours 3 --disk 300
```

g6e capacity is scarce. us-east-1 / us-west-2 / us-east-2 / eu-west-1 / eu-central-1
were all out of g6e capacity; **ap-northeast-1 (Tokyo) had it** — this run landed
there on `g6e.xlarge`. On `InsufficientInstanceCapacity` try the other approved
regions. `ap-southeast-1` has no default VPC and the harness skips it. First boot
waits ~10–15 min on account SSM associations — normal.

> **Prefer `g6e.2xlarge` (or larger) when capacity allows.** 64 GB RAM lets the
> 42 GB checkpoint stay resident and removes the swap-paging load penalty described
> in [Results](#results). On `g6e.xlarge` you must add swap (next step).

### 2. Install code + download weights

```bash
# install the token first (see above), then:
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs run \
  bash -lc 'nohup bash 08-parcel-journey/ai/ltx/setup.sh > ~/ltx-setup.log 2>&1 & \
            echo PID $!; sleep 15; tail -15 ~/ltx-setup.log'
# poll ~/ltx-setup.log until it prints SETUP_OK
```

`setup.sh` (idempotent): installs `uv`, clones `Lightricks/LTX-2` to `~/ltx`,
`uv sync --extra natten` (**torch 2.13.0+cu132, CUDA 13.2** — verified on L40S), and
downloads the distilled split checkpoints to `~/models/ltx-2.5` (~67 GB). Everything
lives **outside `~/showcase`** so the repo rsync's `--delete` never wipes it.

### 2b. Instance workarounds applied this run (g6e.xlarge specifics)

Two instance-local fixes were needed on this AMI/driver and the small instance size.
They do not change the model or settings and are not committed to the repo:

* **64 GB swap file** — the 42 GB checkpoint mmap `Cannot allocate memory` on 30 GB
  RAM. `sudo fallocate -l 64G /swapfile && sudo chmod 600 /swapfile && sudo mkswap
  /swapfile && sudo swapon /swapfile`. Unnecessary on `g6e.2xlarge`+.
* **cuDNN disabled** — the AMI's cuDNN 9.24.0 (CUDA 13.2, driver 595.91.07) fails to
  load its sublibraries on this L40S (`CUDNN_STATUS_SUBLIBRARY_LOADING_FAILED`) for
  **both** SDPA attention *and* `conv3d`. `gen.py` therefore launches the pipeline
  through a bootstrap that sets `torch.backends.cudnn.enabled = False` **after**
  torch is fully imported (a `sitecustomize` set gets reset during torch init), so
  PyTorch uses its native flash / mem-efficient SDPA and cuBLAS conv kernels. This is
  baked into `gen.py`; no manual step.

### 3. Generate

```bash
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs run \
  bash -lc 'cd ~/ltx && nohup env AWS_REGION=ap-northeast-1 LTX_INSTANCE_TYPE=g6e.xlarge \
            uv run python ~/showcase/08-parcel-journey/ai/ltx/gen.py > ~/ltx-gen.log 2>&1 & \
            echo PID $!'
# poll ~/ltx-gen.log until it prints GEN_OK (each clip ~15 min on g6e.xlarge, load-bound)
```

`gen.py` runs the distilled pipeline per shot, times each run, samples `nvidia-smi`
for peak VRAM, strips audio to h264, extracts 4 PNGs per clip at 0.5 / 1.5 / 3 /
4.5 s, runs a **second warm `roast`** for a steady-state reading, and writes
`timing.json`. Outputs land under `08-parcel-journey/out/ai/ltx/` (gitignored).

### 4. Pull, verify, terminate

```bash
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs pull 08-parcel-journey
# verify: ffprobe duration/resolution; eyeball ≥2 PNGs
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs run \
  bash -lc 'rm -f ~/.cache/huggingface/token'   # scrub the token
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs down
OPUS55_INSTANCE=opus55-ltx AWS_REGION=ap-northeast-1 node factory/cloud.mjs status  # confirm gone
```

---

## Files

| Path | What |
|---|---|
| `opus-5.5/08-parcel-journey/ai/ltx/setup.sh` | Install LTX-2 code + download distilled FP8 checkpoints |
| `opus-5.5/08-parcel-journey/ai/ltx/gen.py` | Drive DistilledPipeline (cuDNN-disabled bootstrap), time it, sample VRAM, make clips + PNGs + `timing.json` |
| `opus-5.5/08-parcel-journey/out/ai/ltx/roast.mp4`, `pourover.mp4` | Final clips (h264, 1280×704, 24 fps, 5.04 s, no audio) |
| `opus-5.5/08-parcel-journey/out/ai/ltx/{roast,pourover}_f{1..4}.png` | 4 frames per clip at 0.5 / 1.5 / 3 / 4.5 s |
| `opus-5.5/08-parcel-journey/out/ai/ltx/timing.json` | Machine-readable results (region, instance, GPU, precision, timings, peak VRAM) |
