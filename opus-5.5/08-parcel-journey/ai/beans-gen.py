#!/usr/bin/env python3
"""beans-gen.py — generate the 6 coffee-beans shots (16:9 + 1:1) with LTX-2.5, ONE resident pipeline.

Runs ON the GPU instance inside the ~/ltx uv venv:
    cd ~/ltx && uv run python ~/showcase/08-parcel-journey/ai/beans-gen.py

Why this file and not ai/ltx/gen.py
------------------------------------
`ai/ltx/gen.py` shells out `python -m ltx_pipelines.distilled` once PER CLIP, so every clip re-pays
the ~42 GB checkpoint load (≈15 min on a 30 GB-RAM g6e.xlarge; load-bound). The REPORT's own
recommendation is to run on a resident-RAM box (g6e.2xlarge, 64 GB) and load the model ONCE.
This script does exactly that: it builds the CLI arg namespace once (so model_paths / quantization /
offload / spatial upsampler are resolved identically to the proven CLI run), constructs
`DistilledPipeline` a single time, then calls it per prompt. Load is paid once; each clip after that
is just generation (tens of seconds on a resident box).

Design notes carried over from ai/ltx/gen.py (unchanged, still needed on this AMI/driver):
* cuDNN 9.24 cannot load its sublibraries on this L40S / driver 595 (fails for BOTH SDPA attention
  and conv3d). We disable cuDNN AFTER torch is fully imported, before building the pipeline, so
  PyTorch uses native flash / mem-efficient SDPA and cuBLAS conv kernels.
* DistilledPipeline is the unguided (no-CFG) fast path and takes no negative prompt; bakeoff.json /
  beans-shots.json negatives are recorded as a note, not applied.
* The pipeline emits muxed audio+video; we strip audio (`-an`) to a picture-only h264 mp4.

Outputs (all under 08-parcel-journey/out/ai/beans/, gitignored):
  <shot>_<ar>.mp4                 picture-only h264, yuv420p
  frames/<shot>_<ar>/f%04d.png    EVERY frame of the clip (the engine's deterministic bg layer
                                  samples these by story time)
  contact/<shot>_<ar>.png         one representative mid-clip frame per shot/ar (the "contact frame")
  timing.json                     region/instance/gpu/precision + per-clip wall-clock + peak VRAM
"""
import json, os, subprocess, sys, threading, time
from pathlib import Path

HOME = Path.home()
LTX = HOME / "ltx"
MODELS = HOME / "models" / "ltx-2.5"
SHOWCASE = HOME / "showcase"
AI_DIR = SHOWCASE / "08-parcel-journey" / "ai"
OUT = SHOWCASE / "08-parcel-journey" / "out" / "ai" / "beans"
FRAMES = OUT / "frames"
CONTACT = OUT / "contact"
for d in (OUT, FRAMES, CONTACT):
    d.mkdir(parents=True, exist_ok=True)

SHOTS = json.loads((AI_DIR / "beans-shots.json").read_text())
FPS = SHOTS["fps"]            # 24
SEED = SHOTS["seed"]          # 1111
FRAMINGS = SHOTS["framings"]  # {"16x9": {w,h}, "1x1": {w,h}}

QUANT = os.environ.get("LTX_QUANT", "fp8-cast")
OFFLOAD = os.environ.get("LTX_OFFLOAD", "none")

TRANSFORMER = MODELS / "diffusion_models" / "ltx-2.5-22b-distilled-transformer-bf16.safetensors"
TEXT_ENC = MODELS / "text_encoders" / "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors"
VIDEO_VAE = MODELS / "vae" / "ltx-2.5-video-vae-bf16.safetensors"
AUDIO_VAE = MODELS / "vae" / "ltx-2.5-audio-vae-bf16.safetensors"
SPATIAL_UP = MODELS / "latent_upscale_models" / "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"


def gpu_name():
    try:
        return subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], text=True
        ).strip().splitlines()[0]
    except Exception as e:
        return f"unknown ({e})"


class VramSampler(threading.Thread):
    """Poll nvidia-smi memory.used every 0.5s; record peak MB. Reset per clip."""
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
                self.peak = max(self.peak, max(int(x) for x in out))
            except Exception:
                pass
            self._stop.wait(0.5)

    def stop(self):
        self._stop.set()
        return self.peak


def build_pipeline():
    """Construct DistilledPipeline ONCE, resolving args exactly as ltx_pipelines.distilled.main() does.

    We feed a synthetic argv into the module's own arg parser so model_paths / quantization /
    offload_mode / spatial upsampler path are produced by the SAME code the proven CLI run used —
    no re-implementation of the fp8-cast policy mapping here. We never call its main(); we only reuse
    its parser to get a namespace, then hoist the pipeline construction out of the per-clip loop.
    """
    import torch
    # cuDNN off BEFORE constructing the pipeline (see module docstring).
    torch.backends.cudnn.enabled = False
    torch.backends.cuda.enable_cudnn_sdp(False)

    # ltx_core's attention uses sdpa_kernel([CUDNN, FLASH, EFFICIENT, MATH], set_priority=True),
    # which FORCES cuDNN to the top of the SDPA priority at call time regardless of the global
    # enable_cudnn_sdp(False). On this L40S / driver 595 cuDNN 9.24 cannot load its runtime-compiled
    # engines (CUDNN_STATUS_SUBLIBRARY_LOADING_FAILED), so we drop CUDNN from the priority and prime
    # the cached AUTOMATIC picks with a cuDNN-free order (FLASH > EFFICIENT > MATH). This is the
    # in-process equivalent of the proven "no cuDNN" run; native flash / mem-efficient SDPA work
    # (verified by a conv3d + SDPA probe on this box).
    from torch.nn.attention import SDPBackend
    import ltx_core.model.transformer.attention as _attn
    _NO_CUDNN = (SDPBackend.FLASH_ATTENTION, SDPBackend.EFFICIENT_ATTENTION, SDPBackend.MATH)
    _attn._SDPA_FULL_PRIORITY = _NO_CUDNN
    _no_cudnn_sdpa = _attn.PytorchAttention(priority=list(_NO_CUDNN))
    _attn.automatic_attention.cache_clear(); _attn.automatic_masked_attention.cache_clear()
    _attn.automatic_attention = (lambda f=_no_cudnn_sdpa: f)              # type: ignore[assignment]
    _attn.automatic_masked_attention = (lambda f=_no_cudnn_sdpa: f)       # type: ignore[assignment]

    from ltx_pipelines.distilled import DistilledPipeline
    from ltx_pipelines.utils.args import (
        add_chunk_layout_args, add_generated_keyframes_arg, add_keyframe_decode_arg,
        default_2_stage_distilled_arg_parser, resolve_cli_params,
    )

    argv = [
        "--transformer-path", str(TRANSFORMER),
        "--text-encoder-path", str(TEXT_ENC),
        "--video-vae-path", str(VIDEO_VAE),
        "--audio-vae-path", str(AUDIO_VAE),
        "--spatial-upsampler-path", str(SPATIAL_UP),
        "--quantization", QUANT,
        # a prompt/size/output are required by the parser but we drive generation ourselves below.
        "--prompt", "placeholder", "--width", "1280", "--height", "704",
        "--num-frames", "73", "--frame-rate", str(FPS), "--seed", str(SEED),
        "--output-path", str(OUT / "_unused.mp4"),
    ]
    if OFFLOAD != "none":
        argv += ["--offload", OFFLOAD]

    # resolve_cli_params -> detect_checkpoint_path pre-parses sys.argv (NOT the parser's argv) to
    # pick split vs monolith and read the checkpoint's model version. So set sys.argv to our argv
    # for the duration of params+parser+parse, then restore it.
    saved_argv = sys.argv
    try:
        sys.argv = ["beans-gen"] + argv
        params = resolve_cli_params(distilled=True)
        parser = add_chunk_layout_args(
            add_keyframe_decode_arg(
                add_generated_keyframes_arg(
                    default_2_stage_distilled_arg_parser(params=params, supports_auto_duration=True)
                )
            )
        )
        args = parser.parse_args(argv)
    finally:
        sys.argv = saved_argv

    pipeline = DistilledPipeline(
        model_paths=args.model_paths,
        spatial_upsampler_path=args.spatial_upsampler_path,
        loras=tuple(args.lora) if args.lora else (),
        quantization=args.quantization,
        compilation_config=args.compile,
        offload_mode=args.offload_mode,
        prompt_enhancer_gemma_root=args.prompt_enhancer_gemma_root,
        diffvae_optimization=args.diffvae_optimization,
    )
    return pipeline, args


def generate_one(pipeline, args, prompt, width, height, num_frames, raw_path):
    """One in-process generation + encode. Returns PipelineOutput's effective frame count."""
    import torch
    from ltx_core.model.video_vae import AUTO_TILING
    from ltx_pipelines.utils.media_io import encode_video

    # Re-assert cuDNN OFF before every call: cuDNN 9.24 cannot load its sublibraries on this L40S /
    # driver 595 (fails for SDPA attention AND conv3d). Something between construction and the first
    # forward re-enables it, so we force it off here each time (native flash SDPA + cuBLAS conv).
    torch.backends.cudnn.enabled = False
    torch.backends.cuda.enable_cudnn_sdp(False)

    with torch.inference_mode():
        result = pipeline(
            prompt=prompt,
            seed=SEED,
            height=height,
            width=width,
            frame_rate=FPS,
            images=[],
            num_frames=num_frames,
            tiling_config=AUTO_TILING,
        )
        # PipelineOutput.video is an Iterator[torch.Tensor] of per-decode-chunk (F,H,W,C) tensors
        # (keyframe-aware decoding is already baked into the iterator). encode_video REQUIRES
        # `video_chunks_number`. Rather than guess the chunk count, drain the iterator and
        # concatenate on the frame axis into ONE tensor; encode_video then wraps it as iter([t]),
        # i.e. exactly one chunk. Audio is discarded at the source (picture-only deliverable),
        # which is the documented video-only path and avoids any AAC/sample-rate coupling.
        chunks = list(result.video)
        if not chunks:
            raise RuntimeError("pipeline returned no video chunks")
        video = chunks[0] if len(chunks) == 1 else torch.cat(chunks, dim=0)
        eff_frames = int(video.shape[0])
        encode_video(
            video=video,
            fps=FPS,
            audio=None,
            output_path=str(raw_path),
            video_chunks_number=1,
            audio_sampling_rate=None,
        )
    return eff_frames


def finalize(raw, final, frames_dir, contact_png):
    """Strip audio -> h264 picture-only; dump EVERY frame to PNG; copy one mid-clip contact frame."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(raw), "-an", "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "16", str(final)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(final), str(frames_dir / "f%04d.png")],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    pngs = sorted(frames_dir.glob("f*.png"))
    if pngs:
        mid = pngs[len(pngs) // 2]
        subprocess.run(["cp", str(mid), str(contact_png)], check=True)
    # manifest the engine's video-background layer reads to sample a frame by story time
    (frames_dir / "manifest.json").write_text(json.dumps({"frames": len(pngs), "fps": FPS}))
    return len(pngs)


def main():
    timing = {
        "region": os.environ.get("AWS_REGION", "unknown"),
        "instance_type": os.environ.get("LTX_INSTANCE_TYPE", "unknown"),
        "gpu": gpu_name(),
        "checkpoint": "Lightricks/LTX-2.5 ltx-2.5-22b-distilled-transformer-bf16",
        "variant": "DistilledPipeline (resident, single load)",
        "precision": QUANT,
        "offload": OFFLOAD,
        "fps": FPS,
        "seed": SEED,
        "clips": {},
        "notes": [
            "Pipeline loaded ONCE; every clip after the first is generation-bound, not load-bound.",
            "DistilledPipeline is unguided (no CFG) and takes no negative prompt; "
            "beans-shots.json negative was NOT applied.",
            "Audio discarded (-an); only h264 picture kept. Frames dumped per clip for the engine bg layer.",
        ],
    }

    print("=== loading LTX DistilledPipeline (one time) ===", flush=True)
    load_sampler = VramSampler(); load_sampler.start()
    t_load = time.time()
    pipeline, args = build_pipeline()
    timing["model_load_seconds"] = round(time.time() - t_load, 1)
    timing["peak_vram_mb_after_load"] = load_sampler.stop()
    print(f"loaded in {timing['model_load_seconds']}s", flush=True)

    for shot in SHOTS["shots"]:
        sid = shot["id"]
        nframes = shot["frames"]
        for ar, dims in FRAMINGS.items():
            key = f"{sid}_{ar}"
            prompt = shot["prompt_11"] if ar == "1x1" else shot["prompt"]
            w, h = dims["width"], dims["height"]
            raw = OUT / f"_{key}.raw.mp4"
            final = OUT / f"{key}.mp4"
            print(f"=== {key}  {w}x{h}  {nframes}f ===", flush=True)
            sampler = VramSampler(); sampler.start()
            t0 = time.time()
            try:
                eff = generate_one(pipeline, args, prompt, w, h, nframes, raw)
                secs = round(time.time() - t0, 1)
                peak = sampler.stop()
                npng = finalize(raw, final, FRAMES / key, CONTACT / f"{key}.png")
                timing["clips"][key] = {
                    "width": w, "height": h, "requested_frames": nframes,
                    "effective_frames": eff, "frames_on_disk": npng,
                    "generation_seconds": secs, "peak_vram_mb": peak,
                }
                print(f"  ok: {secs}s, peak {peak} MB, {npng} frames", flush=True)
            except Exception as e:
                sampler.stop()
                timing["clips"][key] = {"error": str(e)[:800]}
                print(f"  FAILED: {e}", flush=True)
            finally:
                try:
                    raw.unlink()
                except OSError:
                    pass

    (OUT / "timing.json").write_text(json.dumps(timing, indent=2))
    print(json.dumps(timing, indent=2), flush=True)
    failed = [k for k, v in timing["clips"].items() if "error" in v]
    if failed:
        print(f"GEN_PARTIAL: {len(failed)} failed: {failed}", flush=True)
        sys.exit(1)
    print("GEN_OK", flush=True)


if __name__ == "__main__":
    main()
