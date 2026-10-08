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
            # model cpu offload: whole components swap on/off GPU (fast); fp8 keeps the transformer small enough.
            pipe.enable_model_cpu_offload()
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
            done.append(sid)
        except Exception as e:
            traceback.print_exc()
            print(f"[{i+1}/{len(ids)}] {sid}: FAIL {type(e).__name__}: {str(e)[:200]}", flush=True)
            failed.append(sid)
            torch.cuda.empty_cache()
    print(f"BATCH_DONE done={len(done)} failed={len(failed)} failed_ids={failed}", flush=True)
    if failed:
        sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("BATCH_FAIL", flush=True)
        sys.exit(1)
