#!/usr/bin/env python3
"""gen.py — benchmark LTX-2.5 (DistilledPipeline, FP8) on one L40S, two text-to-video shots.

Runs ON the instance inside the ~/ltx uv venv:
    cd ~/ltx && uv run python ~/showcase/08-parcel-journey/ai/ltx/gen.py

Design notes
------------
* The official repo exposes generation as runnable CLI modules
  (`python -m ltx_pipelines.distilled ...`). The clean, supported way to drive it
  is to invoke that module as a subprocess. We therefore shell out once per clip
  and measure wall-clock around it; model LOAD time can't be split from the first
  clip by the CLI, so we run a tiny warm-up generation first to pay the load/compile
  cost, time THAT as "model load (incl. first-clip overhead)", then time each real
  clip separately (warm). We also do a second warm run of one clip to confirm steady
  timing — exactly what the brief asks for.
* VRAM: a background sampler polls `nvidia-smi` every 0.5s and records the peak.
* Audio: DistilledPipeline emits audio+video muxed. We strip audio with ffmpeg
  (`-an`) when producing the final h264 picture-only mp4.
* Resolution 1280x704 (both multiples of 64 -> legal). Frames: 5s*24fps=120 ->
  causal grid 8k+1 -> 121 (the pipeline floors off-grid --num-frames anyway).
"""
import json, os, re, subprocess, sys, threading, time, shutil
from pathlib import Path

HOME = Path.home()
LTX = HOME / "ltx"
MODELS = HOME / "models" / "ltx-2.5"
SHOWCASE = HOME / "showcase"
AI_DIR = SHOWCASE / "08-parcel-journey" / "ai"
OUT = SHOWCASE / "08-parcel-journey" / "out" / "ai" / "ltx"
OUT.mkdir(parents=True, exist_ok=True)

BAKEOFF = json.loads((AI_DIR / "bakeoff.json").read_text())
WIDTH = BAKEOFF["size"]["width"]           # 1280
HEIGHT = BAKEOFF["size"]["height"]         # 704
FPS = BAKEOFF["fps"]                        # 24
SECONDS = BAKEOFF["seconds"]               # 5
SEED = BAKEOFF["seed"]                      # 1111
NEGATIVE = BAKEOFF["negative"]
# 5s @ 24fps = 120 frames; causal grid is 8k+1 -> nearest legal is 121.
NUM_FRAMES = 121

TRANSFORMER = MODELS / "diffusion_models" / "ltx-2.5-22b-distilled-transformer-bf16.safetensors"
TEXT_ENC = MODELS / "text_encoders" / "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors"
VIDEO_VAE = MODELS / "vae" / "ltx-2.5-video-vae-bf16.safetensors"
AUDIO_VAE = MODELS / "vae" / "ltx-2.5-audio-vae-bf16.safetensors"
SPATIAL_UP = MODELS / "latent_upscale_models" / "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"

QUANT = os.environ.get("LTX_QUANT", "fp8-cast")   # FP8 so it fits 48GB
OFFLOAD = os.environ.get("LTX_OFFLOAD", "none")   # try none first; "cpu" if OOM
STEPS_NOTE = "distilled: 8 predefined sigmas (8 steps stage1 + 4 steps stage2)"


def gpu_name():
    try:
        return subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], text=True
        ).strip().splitlines()[0]
    except Exception as e:
        return f"unknown ({e})"


class VramSampler(threading.Thread):
    """Poll nvidia-smi memory.used every 0.5s; record peak MB."""
    def __init__(self):
        super().__init__(daemon=True)
        self.peak = 0
        self._stop = threading.Event()

    def run(self):
        while not self._stop.is_set():
            try:
                out = subprocess.check_output(
                    ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                    text=True,
                ).strip().splitlines()
                used = max(int(x) for x in out)
                self.peak = max(self.peak, used)
            except Exception:
                pass
            self._stop.wait(0.5)

    def stop(self):
        self._stop.set()
        return self.peak


def run_pipeline(prompt: str, out_path: Path) -> dict:
    """Invoke the distilled pipeline once. Returns {seconds, peak_vram_mb, warnings}."""
    # NOTE: ltx_pipelines.distilled is the UNGUIDED (no-CFG) distilled path, so its
    # CLI has NO --negative-prompt (that flag only exists on the guided 1-/2-stage
    # parsers). We therefore cannot apply bakeoff.json's negative prompt on this
    # model's fast path; recorded as a warning in timing.json.
    #
    # cuDNN 9.24 cannot load its sublibraries on this L40S / driver 595 (fails for
    # BOTH SDPA attention and conv3d with CUDNN_STATUS_SUBLIBRARY_LOADING_FAILED).
    # A sitecustomize set is reset when torch finishes initialising, so we disable
    # cuDNN *after* torch is fully imported, inside a -c bootstrap that then runpy's
    # the pipeline module with the CLI args as argv. PyTorch falls back to native
    # CUDA kernels (flash / mem-efficient SDPA, cuBLAS conv) — verified working.
    pipe_args = [
        "--transformer-path", str(TRANSFORMER),
        "--text-encoder-path", str(TEXT_ENC),
        "--video-vae-path", str(VIDEO_VAE),
        "--audio-vae-path", str(AUDIO_VAE),
        "--spatial-upsampler-path", str(SPATIAL_UP),
        "--width", str(WIDTH),
        "--height", str(HEIGHT),
        "--num-frames", str(NUM_FRAMES),
        "--frame-rate", str(FPS),
        "--seed", str(SEED),
        "--quantization", QUANT,
        "--prompt", prompt,
        "--output-path", str(out_path),
    ]
    if OFFLOAD != "none":
        pipe_args += ["--offload", OFFLOAD]

    bootstrap = (
        "import torch, sys, runpy;"
        "torch.backends.cudnn.enabled=False;"
        "torch.backends.cuda.enable_cudnn_sdp(False);"
        "sys.argv=['ltx_pipelines.distilled']+sys.argv[1:];"
        "runpy.run_module('ltx_pipelines.distilled', run_name='__main__')"
    )
    cmd = ["uv", "run", "python", "-c", bootstrap] + pipe_args

    sampler = VramSampler()
    sampler.start()
    t0 = time.time()
    proc = subprocess.run(cmd, cwd=str(LTX), text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    secs = time.time() - t0
    peak = sampler.stop()
    log = proc.stdout or ""
    # keep the tail of the log for diagnosis
    (OUT / f"{out_path.stem}.log").write_text(log)
    warnings = re.findall(r"(?i)\b(warn(?:ing)?|oom|out of memory|fallback|deprecat\w*)\b.*", log)
    if proc.returncode != 0:
        raise RuntimeError(
            f"pipeline failed ({proc.returncode}) for {out_path.name}; tail:\n" + "\n".join(log.splitlines()[-40:])
        )
    return {"seconds": round(secs, 1), "peak_vram_mb": peak, "warnings": warnings[:20]}


def finalize(raw: Path, final: Path, stem: str):
    """Strip audio -> h264 picture-only mp4; extract 4 PNG frames at 0.5/1.5/3/4.5s."""
    # picture-only, h264, yuv420p for broad compatibility
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(raw), "-an", "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "18", str(final)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for i, t in enumerate([0.5, 1.5, 3.0, 4.5], start=1):
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(final), "-frames:v", "1",
             str(OUT / f"{stem}_f{i}.png")],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )


def main():
    shots = {s["id"]: s for s in BAKEOFF["shots"]}
    timing = {
        "region": os.environ.get("AWS_REGION", "unknown"),
        "instance_type": os.environ.get("LTX_INSTANCE_TYPE", "unknown"),
        "gpu": gpu_name(),
        "checkpoint": "Lightricks/LTX-2.5 ltx-2.5-22b-distilled-transformer-bf16",
        "variant": "DistilledPipeline",
        "precision": QUANT,
        "offload": OFFLOAD,
        "steps": STEPS_NOTE,
        "resolution": f"{WIDTH}x{HEIGHT}",
        "frames": NUM_FRAMES,
        "fps": FPS,
        "requested_seconds": SECONDS,
        "seed": SEED,
        "clips": {},
        "warnings": [],
        "notes": [
            "num_frames=121 (5s*24fps=120 -> causal grid 8k+1 -> nearest legal 121); clip is ~5.04s.",
            "DistilledPipeline is unguided (no CFG) and exposes no --negative-prompt; "
            "bakeoff.json negative prompt was NOT applied on this fast path.",
            "Audio generated by the pipeline is discarded (-an) in post; only picture (h264) kept.",
        ],
    }

    # --- warm-up: pays model load + first-run compile; timed as "load" ---
    warm_raw = OUT / "_warmup_roast.raw.mp4"
    print("=== warm-up / model load (roast prompt) ===", flush=True)
    warm = run_pipeline(shots["roast"]["prompt"], warm_raw)
    timing["model_load_plus_firstrun_seconds"] = warm["seconds"]
    timing["warnings"] += warm["warnings"]
    # the warm-up output IS a valid roast clip; keep it as the roast result.
    finalize(warm_raw, OUT / "roast.mp4", "roast")
    timing["clips"]["roast"] = {
        "generation_seconds_cold_includes_load": warm["seconds"],
        "peak_vram_mb": warm["peak_vram_mb"],
        "note": "first run; includes model load + compile",
    }

    # --- warm run: pourover (second shot), excludes load ---
    print("=== warm run: pourover ===", flush=True)
    po_raw = OUT / "_pourover.raw.mp4"
    po = run_pipeline(shots["pourover"]["prompt"], po_raw)
    finalize(po_raw, OUT / "pourover.mp4", "pourover")
    timing["clips"]["pourover"] = {
        "generation_seconds_warm": po["seconds"],
        "peak_vram_mb": po["peak_vram_mb"],
    }
    timing["warnings"] += po["warnings"]

    # --- second warm run of one clip (roast again) to confirm steady timing ---
    print("=== second warm run: roast (steady-state check) ===", flush=True)
    roast2_raw = OUT / "_roast2.raw.mp4"
    roast2 = run_pipeline(shots["roast"]["prompt"], roast2_raw)
    timing["clips"]["roast_second_warm_run"] = {
        "generation_seconds_warm": roast2["seconds"],
        "peak_vram_mb": roast2["peak_vram_mb"],
        "note": "same prompt/seed as roast; warm, excludes load — the real per-clip speed",
    }
    timing["warnings"] += roast2["warnings"]

    # dedupe warnings, cleanup raw temps
    timing["warnings"] = sorted(set(timing["warnings"]))[:40]
    for p in [warm_raw, po_raw, roast2_raw]:
        try:
            p.unlink()
        except OSError:
            pass

    (OUT / "timing.json").write_text(json.dumps(timing, indent=2))
    print(json.dumps(timing, indent=2))
    print("GEN_OK")


if __name__ == "__main__":
    main()
