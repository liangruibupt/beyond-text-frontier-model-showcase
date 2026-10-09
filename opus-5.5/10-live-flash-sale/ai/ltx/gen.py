#!/usr/bin/env python3
"""ltx-gen.py — LTX-2.5 bake-off generator for film 10 (lantern room + cart, 16:9).

Runs ON the GPU instance inside the ~/ltx uv venv:
    cd ~/ltx && uv run python ~/showcase/10-live-flash-sale/ai/ltx-gen.py

Loads DistilledPipeline ONCE (resident, per 08's REPORT recommendation), then generates the
two bake-off shots from ../bakeoff.json using the lantern 16:9 prompts in ../shots.json.
Carries over every workaround proven in 08-parcel-journey/ai/beans-gen.py (cuDNN off on this
L40S/driver, unguided no-negative fast path, picture-only h264). Outputs under
10-live-flash-sale/out/ai/ltx/ (gitignored):
  <shot>_16x9.mp4                picture-only h264
  frames/<shot>_16x9/f%04d.png  every frame
  contact/<shot>_16x9.png       mid-clip frame
  timing.json                   region/instance/gpu/precision + per-clip wall + peak VRAM
"""
import json, os, subprocess, sys, threading, time
from pathlib import Path

HOME = Path.home()
MODELS = HOME / "models" / "ltx-2.5"
SHOWCASE = HOME / "showcase"
AI_DIR = SHOWCASE / "10-live-flash-sale" / "ai"
OUT = SHOWCASE / "10-live-flash-sale" / "out" / "ai" / "ltx"
FRAMES = OUT / "frames"; CONTACT = OUT / "contact"
for d in (OUT, FRAMES, CONTACT):
    d.mkdir(parents=True, exist_ok=True)

BAKE = json.loads((AI_DIR / "bakeoff.json").read_text())
SHOTS_JSON = json.loads((AI_DIR / "shots.json").read_text())
SHOT_BY_ID = {s["id"]: s for s in SHOTS_JSON["shots"]}
ITEM = BAKE["item"]                 # lantern
WIDTH = BAKE["size"]["width"]       # 1280
HEIGHT = BAKE["size"]["height"]     # 704
FPS = BAKE["fps"]                   # 24
SEED = BAKE["seed"]                 # 1111
NFRAMES = BAKE["frame_grids"]["ltx"]  # 73
BAKE_SHOTS = BAKE["shots"]          # ["room","cart"]

QUANT = os.environ.get("LTX_QUANT", "fp8-cast")
OFFLOAD = os.environ.get("LTX_OFFLOAD", "none")

TRANSFORMER = MODELS / "diffusion_models" / "ltx-2.5-22b-distilled-transformer-bf16.safetensors"
TEXT_ENC = MODELS / "text_encoders" / "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors"
VIDEO_VAE = MODELS / "vae" / "ltx-2.5-video-vae-bf16.safetensors"
AUDIO_VAE = MODELS / "vae" / "ltx-2.5-audio-vae-bf16.safetensors"
SPATIAL_UP = MODELS / "latent_upscale_models" / "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"


def gpu_name():
    try:
        return subprocess.check_output(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], text=True).strip().splitlines()[0]
    except Exception as e:
        return f"unknown ({e})"


class VramSampler(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True); self.peak = 0; self._stop = threading.Event()
    def run(self):
        while not self._stop.is_set():
            try:
                out = subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], text=True).strip().splitlines()
                self.peak = max(self.peak, max(int(x) for x in out))
            except Exception:
                pass
            self._stop.wait(0.5)
    def stop(self):
        self._stop.set(); return self.peak


def build_pipeline():
    import torch
    torch.backends.cudnn.enabled = False
    torch.backends.cuda.enable_cudnn_sdp(False)
    from torch.nn.attention import SDPBackend
    import ltx_core.model.transformer.attention as _attn
    _NO_CUDNN = (SDPBackend.FLASH_ATTENTION, SDPBackend.EFFICIENT_ATTENTION, SDPBackend.MATH)
    _attn._SDPA_FULL_PRIORITY = _NO_CUDNN
    _no_cudnn = _attn.PytorchAttention(priority=list(_NO_CUDNN))
    _attn.automatic_attention.cache_clear(); _attn.automatic_masked_attention.cache_clear()
    _attn.automatic_attention = (lambda f=_no_cudnn: f)
    _attn.automatic_masked_attention = (lambda f=_no_cudnn: f)
    from ltx_pipelines.distilled import DistilledPipeline
    from ltx_pipelines.utils.args import (
        add_chunk_layout_args, add_generated_keyframes_arg, add_keyframe_decode_arg,
        default_2_stage_distilled_arg_parser, resolve_cli_params,
    )
    argv = [
        "--transformer-path", str(TRANSFORMER), "--text-encoder-path", str(TEXT_ENC),
        "--video-vae-path", str(VIDEO_VAE), "--audio-vae-path", str(AUDIO_VAE),
        "--spatial-upsampler-path", str(SPATIAL_UP), "--quantization", QUANT,
        "--prompt", "placeholder", "--width", str(WIDTH), "--height", str(HEIGHT),
        "--num-frames", str(NFRAMES), "--frame-rate", str(FPS), "--seed", str(SEED),
        "--output-path", str(OUT / "_unused.mp4"),
    ]
    if OFFLOAD != "none":
        argv += ["--offload", OFFLOAD]
    saved = sys.argv
    try:
        sys.argv = ["ltx-gen"] + argv
        params = resolve_cli_params(distilled=True)
        parser = add_chunk_layout_args(add_keyframe_decode_arg(add_generated_keyframes_arg(
            default_2_stage_distilled_arg_parser(params=params, supports_auto_duration=True))))
        args = parser.parse_args(argv)
    finally:
        sys.argv = saved
    pipeline = DistilledPipeline(
        model_paths=args.model_paths, spatial_upsampler_path=args.spatial_upsampler_path,
        loras=tuple(args.lora) if args.lora else (), quantization=args.quantization,
        compilation_config=args.compile, offload_mode=args.offload_mode,
        prompt_enhancer_gemma_root=args.prompt_enhancer_gemma_root,
        diffvae_optimization=args.diffvae_optimization,
    )
    return pipeline, args


def generate_one(pipeline, prompt, raw_path):
    import torch
    from ltx_core.model.video_vae import AUTO_TILING
    from ltx_pipelines.utils.media_io import encode_video
    torch.backends.cudnn.enabled = False
    torch.backends.cuda.enable_cudnn_sdp(False)
    with torch.inference_mode():
        result = pipeline(prompt=prompt, seed=SEED, height=HEIGHT, width=WIDTH,
                          frame_rate=FPS, images=[], num_frames=NFRAMES, tiling_config=AUTO_TILING)
        chunks = list(result.video)
        if not chunks:
            raise RuntimeError("no video chunks")
        video = chunks[0] if len(chunks) == 1 else torch.cat(chunks, dim=0)
        eff = int(video.shape[0])
        encode_video(video=video, fps=FPS, audio=None, output_path=str(raw_path),
                     video_chunks_number=1, audio_sampling_rate=None)
    return eff


def finalize(raw, final, frames_dir, contact_png):
    frames_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-i", str(raw), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", str(final)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["ffmpeg", "-y", "-i", str(final), str(frames_dir / "f%04d.png")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pngs = sorted(frames_dir.glob("f*.png"))
    if pngs:
        subprocess.run(["cp", str(pngs[len(pngs)//2]), str(contact_png)], check=True)
    (frames_dir / "manifest.json").write_text(json.dumps({"frames": len(pngs), "fps": FPS}))
    return len(pngs)


def main():
    timing = {
        "model": "LTX-2.5 DistilledPipeline (resident single load)",
        "region": os.environ.get("AWS_REGION", "unknown"),
        "instance_type": os.environ.get("LTX_INSTANCE_TYPE", "unknown"),
        "gpu": gpu_name(), "precision": QUANT, "offload": OFFLOAD,
        "fps": FPS, "seed": SEED, "num_frames": NFRAMES, "resolution": f"{WIDTH}x{HEIGHT}",
        "clips": {},
        "notes": [
            "Pipeline loaded ONCE; clips after the first are generation-bound.",
            "DistilledPipeline is unguided (no CFG), takes no negative prompt; bakeoff negative NOT applied.",
            "Audio discarded (-an); picture-only h264.",
        ],
    }
    print("=== loading LTX DistilledPipeline (one time) ===", flush=True)
    ls = VramSampler(); ls.start(); t = time.time()
    pipeline, _ = build_pipeline()
    timing["model_load_seconds"] = round(time.time() - t, 1)
    timing["peak_vram_mb_after_load"] = ls.stop()
    print(f"loaded in {timing['model_load_seconds']}s", flush=True)

    for sid in BAKE_SHOTS:
        prompt = SHOT_BY_ID[sid][ITEM]["16x9"]
        key = f"{sid}_16x9"
        raw = OUT / f"_{key}.raw.mp4"; final = OUT / f"{key}.mp4"
        print(f"=== {key}  {WIDTH}x{HEIGHT}  {NFRAMES}f ===", flush=True)
        s = VramSampler(); s.start(); t0 = time.time()
        try:
            eff = generate_one(pipeline, prompt, raw)
            secs = round(time.time() - t0, 1); peak = s.stop()
            npng = finalize(raw, final, FRAMES / key, CONTACT / f"{key}.png")
            timing["clips"][key] = {"effective_frames": eff, "frames_on_disk": npng,
                                    "generation_seconds": secs, "peak_vram_mb": peak}
            print(f"  ok: {secs}s, peak {peak} MB, {npng} frames", flush=True)
        except Exception as e:
            s.stop(); timing["clips"][key] = {"error": str(e)[:800]}
            print(f"  FAILED: {e}", flush=True)
        finally:
            try: raw.unlink()
            except OSError: pass

    (OUT / "timing.json").write_text(json.dumps(timing, indent=2))
    print(json.dumps(timing, indent=2), flush=True)
    if [k for k, v in timing["clips"].items() if "error" in v]:
        print("GEN_PARTIAL", flush=True); sys.exit(1)
    print("GEN_OK", flush=True)


if __name__ == "__main__":
    main()
