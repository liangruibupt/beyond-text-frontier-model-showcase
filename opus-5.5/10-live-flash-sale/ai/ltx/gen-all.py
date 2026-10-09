#!/usr/bin/env python3
"""gen-all.py — stage B: generate EVERY film-10 clip (3 items x 6 shots x {16x9, 1x1}) with LTX-2.5.

Runs ON the GPU instance inside the ~/ltx uv venv (same pipeline + workarounds as ./gen.py, the stage-A
bake-off generator):
    cd ~/ltx && uv run python ~/showcase/10-live-flash-sale/ai/ltx/gen-all.py

DistilledPipeline is loaded ONCE and clips are generated sequentially. Prompts come from ../shots.json
(shots[].<item>.<ar>), frame counts from shots[].frames, sizes from framings. Per-clip seeds come from
../seeds.json ({"<item>/<shot>_<ar>": seed}) and fall back to shots.json's global seed — a retried clip
gets a new seed there, so the committed seeds.json reproduces the accepted footage.

Env:
  GEN_ONLY   comma list of keys "<item>/<shot>_<ar>" to (re)generate; implies overwrite. Default: all.
  GEN_FORCE  1 = overwrite clips that already exist (default: skip them, so a restarted run resumes).

Outputs under 10-live-flash-sale/out/ai/ (gitignored):
  <item>/<shot>_<ar>.mp4                picture-only h264
  <item>/frames/<shot>_<ar>/f%04d.png   every frame + manifest.json  (js/world-ai.js samples these)
  look/10ai-<item>-<shot>-<ar>-{f1,mid,last}.png   review stills
  timing.json                            per-clip seconds / peak VRAM / seed (merged across runs)
"""
import json, os, subprocess, sys, threading, time
from pathlib import Path

HOME = Path.home()
MODELS = HOME / "models" / "ltx-2.5"
FILM = HOME / "showcase" / "10-live-flash-sale"
AI_DIR = FILM / "ai"
OUT = FILM / "out" / "ai"
LOOK = OUT / "look"
LOOK.mkdir(parents=True, exist_ok=True)

SPEC = json.loads((AI_DIR / "shots.json").read_text())
SEEDS_FILE = AI_DIR / "seeds.json"
SEEDS = json.loads(SEEDS_FILE.read_text()) if SEEDS_FILE.exists() else {}
FPS = SPEC["fps"]
SEED0 = SPEC["seed"]
FRAMINGS = SPEC["framings"]
ITEMS = list(SPEC["items"].keys())                 # lantern, headset, beans
SHOT_BY_ID = {s["id"]: s for s in SPEC["shots"]}
QUANT = os.environ.get("LTX_QUANT", "fp8-cast")
GEN_ONLY = [x for x in os.environ.get("GEN_ONLY", "").split(",") if x]
FORCE = os.environ.get("GEN_FORCE") == "1" or bool(GEN_ONLY)

TRANSFORMER = MODELS / "diffusion_models" / "ltx-2.5-22b-distilled-transformer-bf16.safetensors"
TEXT_ENC = MODELS / "text_encoders" / "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors"
VIDEO_VAE = MODELS / "vae" / "ltx-2.5-video-vae-bf16.safetensors"
AUDIO_VAE = MODELS / "vae" / "ltx-2.5-audio-vae-bf16.safetensors"
SPATIAL_UP = MODELS / "latent_upscale_models" / "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"


def order():
    """Deliverables first: every 16:9 clip, then the 1:1 clips the 6 s cut uses, then the other 1:1 clips."""
    keys = [f"{it}/{s}_16x9" for it in ITEMS for s in SHOT_BY_ID]
    keys += [f"{it}/{s}_1x1" for it in ITEMS for s in ("count", "rain", "end")]
    keys += [f"{it}/{s}_1x1" for it in ITEMS for s in ("room", "cart", "stock")]
    return [k for k in keys if k in GEN_ONLY] if GEN_ONLY else keys


class VramSampler(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True); self.peak = 0; self._stop = threading.Event()
    def run(self):
        while not self._stop.is_set():
            try:
                out = subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], text=True)
                self.peak = max(self.peak, max(int(x) for x in out.split()))
            except Exception:
                pass
            self._stop.wait(0.5)
    def stop(self):
        self._stop.set(); return self.peak


def build_pipeline():
    import torch
    torch.backends.cudnn.enabled = False                 # cuDNN sublibs fail on this L40S / driver (see gen.py)
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
    f = FRAMINGS["16x9"]
    argv = [
        "--transformer-path", str(TRANSFORMER), "--text-encoder-path", str(TEXT_ENC),
        "--video-vae-path", str(VIDEO_VAE), "--audio-vae-path", str(AUDIO_VAE),
        "--spatial-upsampler-path", str(SPATIAL_UP), "--quantization", QUANT,
        "--prompt", "placeholder", "--width", str(f["width"]), "--height", str(f["height"]),
        "--num-frames", "73", "--frame-rate", str(FPS), "--seed", str(SEED0),
        "--output-path", str(OUT / "_unused.mp4"),
    ]
    saved = sys.argv
    try:
        sys.argv = ["gen-all"] + argv
        params = resolve_cli_params(distilled=True)
        parser = add_chunk_layout_args(add_keyframe_decode_arg(add_generated_keyframes_arg(
            default_2_stage_distilled_arg_parser(params=params, supports_auto_duration=True))))
        args = parser.parse_args(argv)
    finally:
        sys.argv = saved
    return DistilledPipeline(
        model_paths=args.model_paths, spatial_upsampler_path=args.spatial_upsampler_path,
        loras=tuple(args.lora) if args.lora else (), quantization=args.quantization,
        compilation_config=args.compile, offload_mode=args.offload_mode,
        prompt_enhancer_gemma_root=args.prompt_enhancer_gemma_root,
        diffvae_optimization=args.diffvae_optimization,
    )


def generate_one(pipeline, prompt, seed, w, h, n, raw_path):
    import torch
    from ltx_core.model.video_vae import AUTO_TILING
    from ltx_pipelines.utils.media_io import encode_video
    with torch.inference_mode():
        result = pipeline(prompt=prompt, seed=seed, height=h, width=w, frame_rate=FPS,
                          images=[], num_frames=n, tiling_config=AUTO_TILING)
        chunks = list(result.video)
        if not chunks:
            raise RuntimeError("no video chunks")
        video = chunks[0] if len(chunks) == 1 else torch.cat(chunks, dim=0)
        encode_video(video=video, fps=FPS, audio=None, output_path=str(raw_path),
                     video_chunks_number=1, audio_sampling_rate=None)
    return int(video.shape[0])


def finalize(raw, final, frames_dir, look_stem):
    q = dict(check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["ffmpeg", "-y", "-i", str(raw), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", str(final)], **q)
    subprocess.run(["rm", "-rf", str(frames_dir)], check=True)
    frames_dir.mkdir(parents=True)
    subprocess.run(["ffmpeg", "-y", "-i", str(final), str(frames_dir / "f%04d.png")], **q)
    pngs = sorted(frames_dir.glob("f*.png"))
    (frames_dir / "manifest.json").write_text(json.dumps({"frames": len(pngs), "fps": FPS}))
    for tag, p in (("f1", pngs[0]), ("mid", pngs[len(pngs) // 2]), ("last", pngs[-1])):
        subprocess.run(["cp", str(p), f"{look_stem}-{tag}.png"], check=True)
    return len(pngs)


def main():
    tpath = OUT / "timing.json"
    timing = json.loads(tpath.read_text()) if tpath.exists() else {"clips": {}}
    timing.update({"model": "LTX-2.5 DistilledPipeline (resident single load)", "precision": QUANT, "fps": FPS,
                   "region": os.environ.get("AWS_REGION", "unknown"), "instance_type": os.environ.get("LTX_INSTANCE_TYPE", "unknown")})
    todo = []
    for key in order():
        item, rest = key.split("/"); shot, ar = rest.rsplit("_", 1)
        final = OUT / item / f"{shot}_{ar}.mp4"
        if final.exists() and not FORCE:
            print(f"skip {key} (exists)", flush=True); continue
        todo.append((key, item, shot, ar, final))
    print(f"=== {len(todo)} clips to generate ===", flush=True)
    if not todo:
        print("GEN_OK", flush=True); return
    t = time.time(); pipeline = build_pipeline()
    timing["model_load_seconds"] = round(time.time() - t, 1)
    print(f"loaded in {timing['model_load_seconds']}s", flush=True)

    failed = []
    for i, (key, item, shot, ar, final) in enumerate(todo, 1):
        sh = SHOT_BY_ID[shot]; prompt = sh[item][ar]; seed = int(SEEDS.get(key, SEED0))
        w, h, n = FRAMINGS[ar]["width"], FRAMINGS[ar]["height"], sh["frames"]
        final.parent.mkdir(parents=True, exist_ok=True)
        raw = final.with_suffix(".raw.mp4")
        print(f"=== [{i}/{len(todo)}] {key} {w}x{h} {n}f seed {seed} ===", flush=True)
        s = VramSampler(); s.start(); t0 = time.time()
        try:
            eff = generate_one(pipeline, prompt, seed, w, h, n, raw)
            secs = round(time.time() - t0, 1); peak = s.stop()
            nf = finalize(raw, final, final.parent / "frames" / f"{shot}_{ar}", LOOK / f"10ai-{item}-{shot}-{ar}")
            timing["clips"][key] = {"seed": seed, "frames": nf, "effective_frames": eff, "generation_seconds": secs, "peak_vram_mb": peak}
            print(f"  ok {secs}s peak {peak}MB {nf} frames", flush=True)
        except Exception as e:
            s.stop(); failed.append(key); timing["clips"][key] = {"seed": seed, "error": str(e)[:800]}
            print(f"  FAILED: {e}", flush=True)
        finally:
            raw.unlink(missing_ok=True)
            tpath.write_text(json.dumps(timing, indent=2))
    print(json.dumps({"failed": failed}), flush=True)
    print("GEN_PARTIAL" if failed else "GEN_OK", flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
