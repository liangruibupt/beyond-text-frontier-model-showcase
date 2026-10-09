#!/usr/bin/env python
# gen_batch.py — 方式二批量生成：读 prompts.json，加载一次 LTX-2.5（fp8 + model offload，24 步 + CFG），
# 逐镜头生成 MP4 + 首帧/尾帧 PNG，可断点续跑（已有尾帧 PNG 的镜头跳过）。只产出 PNG 回传，视频留在 box。
# 用法：HF_TOKEN=... HF_HOME=/opt/dlami/nvme/hf \
#   STEPS=24 ONLY=qh_paint,dh_cave python gen_batch.py     # ONLY 可选，逗号分隔，限定镜头
import os, sys, json, time, traceback
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("LTX_REPO", "Lightricks/LTX-2.5-Diffusers")
PROMPTS = os.environ.get("PROMPTS", os.path.join(HERE, "prompts.json"))
OUT = os.environ.get("OUT", "/opt/dlami/nvme/ltx-src/out")
STEPS = int(os.environ.get("STEPS", "24"))
ONLY = set(x for x in os.environ.get("ONLY", "").split(",") if x)
os.makedirs(OUT, exist_ok=True)

# Durable archival: push every shot's MP4 + first/last PNG to S3 the moment it finishes,
# so a terminated instance never loses completed work (NVMe dies with the instance).
S3_BUCKET = os.environ.get("S3_BUCKET", "cdh-ingest-demo")
S3_PREFIX = os.environ.get("S3_PREFIX", "showcase-ltx/07-unboxing")
_s3 = None
def _s3_push(local_path, key):
    global _s3
    if _s3 is None:
        import boto3
        _s3 = boto3.client("s3")
    try:
        _s3.upload_file(local_path, S3_BUCKET, key)
        print(f"    S3 ok: s3://{S3_BUCKET}/{key}", flush=True)
        return True
    except Exception as e:
        print(f"    S3 FAIL {key}: {type(e).__name__}: {str(e)[:150]}", flush=True)
        return False


def load_pipe():
    import diffusers
    from diffusers import AutoModel
    print("diffusers", diffusers.__version__, flush=True)
    # fp8 layerwise weight-casting on the 13B transformer -> fits with model (not sequential) offload = fast.
    transformer = AutoModel.from_pretrained(REPO, subfolder="transformer", torch_dtype=torch.bfloat16)
    transformer.enable_layerwise_casting(storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16)
    print("transformer: fp8 layerwise casting on", flush=True)
    errs = []
    for name in ("LTX2Pipeline", "LTXPipeline", "LTXConditionPipeline"):
        cls = getattr(diffusers, name, None)
        if cls is None:
            errs.append(f"{name}: n/a"); continue
        try:
            t0 = time.time()
            pipe = cls.from_pretrained(REPO, transformer=transformer, torch_dtype=torch.bfloat16)
            print(f"loaded {name} in {time.time()-t0:.0f}s", flush=True)
            # LTX-2.5 adds a large Gemma-4 text encoder + diffusion decoder + audio vae on top of the
            # 13B transformer; model-level offload still peaks past 48GB on the L40S (OOM in encode_prompt).
            # sequential offload swaps layer-by-layer: slower but fits comfortably. VAE tiling further caps peak.
            pipe.enable_sequential_cpu_offload()
            try: pipe.vae.enable_tiling()
            except Exception: pass
            return pipe
        except Exception as e:
            errs.append(f"{name}: {type(e).__name__}: {str(e)[:200]}")
    raise RuntimeError("no LTX pipeline loaded:\n" + "\n".join(errs))


def main():
    cfg = json.load(open(PROMPTS))
    d = cfg["_defaults"]
    shots = cfg["shots"]
    ids = [k for k in shots if (not ONLY or k in ONLY)]
    print(f"shots to do: {len(ids)} -> {ids}", flush=True)
    pipe = load_pipe()
    from diffusers.utils import export_to_video
    done, failed = [], []
    for i, sid in enumerate(ids):
        last_png = os.path.join(OUT, f"{sid}_last.png")
        if os.path.exists(last_png):
            print(f"[{i+1}/{len(ids)}] {sid}: SKIP (exists)", flush=True); done.append(sid); continue
        s = shots[sid]
        kw = dict(
            prompt=s["prompt"],
            negative_prompt=s.get("negative_prompt", d["negative_prompt"]),
            width=s.get("width", d["width"]), height=s.get("height", d["height"]),
            num_frames=s.get("num_frames", d["num_frames"]),
            num_inference_steps=s.get("num_inference_steps", STEPS),
            guidance_scale=s.get("guidance_scale", d["guidance_scale"]),
            generator=torch.Generator("cuda").manual_seed(s.get("seed", 7)),
        )
        t0 = time.time()
        try:
            out = pipe(**kw)
            frames = out.frames[0]
            mp4 = os.path.join(OUT, f"{sid}.mp4")
            export_to_video(frames, mp4, fps=d["fps"])
            frames[0].save(os.path.join(OUT, f"{sid}_first.png"))
            frames[-1].save(last_png)
            dt = time.time() - t0
            print(f"[{i+1}/{len(ids)}] {sid}: OK {len(frames)}f {dt:.0f}s -> {sid}.mp4 +first/last", flush=True)
            # push durably to S3 right away (video + both frames) so a terminated instance loses nothing
            _s3_push(mp4, f"{S3_PREFIX}/mp4/{sid}.mp4")
            _s3_push(os.path.join(OUT, f"{sid}_first.png"), f"{S3_PREFIX}/frames/{sid}_first.png")
            _s3_push(last_png, f"{S3_PREFIX}/frames/{sid}_last.png")
            done.append(sid)
        except Exception as e:
            traceback.print_exc()
            print(f"[{i+1}/{len(ids)}] {sid}: FAIL {type(e).__name__}: {str(e)[:200]}", flush=True)
            failed.append(sid)
            torch.cuda.empty_cache()
    print(f"BATCH_DONE done={len(done)} failed={len(failed)} failed_ids={failed}", flush=True)
    # backstop: sweep the whole OUT dir to S3 once more, catching any per-shot push that failed mid-run.
    import glob as _g
    swept = 0
    for f in sorted(_g.glob(os.path.join(OUT, "*"))):
        b = os.path.basename(f)
        if b.endswith(".mp4"):
            if _s3_push(f, f"{S3_PREFIX}/mp4/{b}"): swept += 1
        elif b.endswith(".png"):
            if _s3_push(f, f"{S3_PREFIX}/frames/{b}"): swept += 1
    print(f"S3_SWEEP uploaded={swept}", flush=True)
    if failed:
        sys.exit(2)


if __name__ == "__main__":
    rc = 0
    try:
        main()
    except SystemExit as e:
        rc = e.code or 0
    except Exception:
        traceback.print_exc()
        print("BATCH_FAIL", flush=True)
        rc = 1
    # cost guard: when AUTO_POWEROFF=1, shut the instance down the moment the batch ends (success OR fail),
    # so a finished run never idles waiting for an external monitor to catch the deadline. Outputs are
    # already on S3 (+ pulled locally); the deadline cron is only a backstop. Needs passwordless sudo.
    if os.environ.get("AUTO_POWEROFF") == "1":
        print(f"AUTO_POWEROFF: shutting down (rc={rc})", flush=True)
        try:
            import subprocess
            subprocess.run(["sudo", "/sbin/poweroff"], timeout=30)
        except Exception as e:
            print(f"poweroff failed: {type(e).__name__}: {str(e)[:120]}", flush=True)
    sys.exit(rc)
