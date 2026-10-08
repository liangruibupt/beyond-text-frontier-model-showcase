#!/usr/bin/env python
# probe_ltx.py — 一次性验证：加载 LTX-2.5，生成一个短镜头，存 MP4 + 首帧/尾帧 PNG。
# 只回传 PNG（截图），不回传视频。用法：HF_TOKEN=... HF_HOME=/opt/dlami/nvme/hf python probe_ltx.py
import os, sys, time, traceback
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
import torch

REPO = os.environ.get("LTX_REPO", "Lightricks/LTX-2.5-Diffusers")
OUT = os.environ.get("OUT", "/opt/dlami/nvme/ltx-src/probe")
os.makedirs(OUT, exist_ok=True)
PROMPT = ("A luxury silk scarf product shot: a calligraphy brush paints a flowing blue cobalt "
          "lotus scroll onto white porcelain, ink blooming and spreading in cinematic macro, "
          "soft studio light, elegant, high detail, slow graceful camera push-in, real footage")
NEG = "worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark, logo"

def load():
    import diffusers
    print("diffusers", diffusers.__version__, flush=True)
    from diffusers import AutoModel
    # fp8 layerwise weight-casting on the 13B transformer halves its resident footprint on the L40S.
    transformer = None
    try:
        transformer = AutoModel.from_pretrained(REPO, subfolder="transformer", torch_dtype=torch.bfloat16)
        transformer.enable_layerwise_casting(storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16)
        print("transformer: fp8 layerwise casting on", flush=True)
    except Exception as e:
        print("fp8 cast unavailable:", str(e)[:160], flush=True)
    errs = []
    for name in ("LTX2Pipeline", "LTXPipeline", "LTXConditionPipeline"):
        cls = getattr(diffusers, name, None)
        if cls is None:
            errs.append(f"{name}: not in diffusers"); continue
        try:
            t0 = time.time()
            kw = dict(torch_dtype=torch.bfloat16)
            if transformer is not None: kw["transformer"] = transformer
            pipe = cls.from_pretrained(REPO, **kw)
            print(f"loaded {name} from {REPO} in {time.time()-t0:.0f}s", flush=True)
            return name, pipe
        except Exception as e:
            errs.append(f"{name}: {type(e).__name__}: {str(e)[:300]}")
    raise RuntimeError("could not load any LTX pipeline:\n" + "\n".join(errs))

def main():
    name, pipe = load()
    # L40S 44GB: sequential CPU offload streams submodules on/off GPU — slow but fits the 13B model.
    moved = False
    for m in ("enable_sequential_cpu_offload", "enable_model_cpu_offload"):
        fn = getattr(pipe, m, None)
        if fn:
            try: fn(); moved = True; print("offload:", m, flush=True); break
            except Exception as e: print("offload", m, "failed:", str(e)[:120], flush=True)
    if not moved:
        pipe.to("cuda")
    for meth in ("enable_tiling",):
        try: getattr(pipe.vae, meth)()
        except Exception: pass
    t0 = time.time()
    kw = dict(prompt=PROMPT, negative_prompt=NEG, width=704, height=480,
              num_frames=73, num_inference_steps=30,
              generator=torch.Generator("cuda").manual_seed(7))
    try:
        out = pipe(**kw)
    except TypeError as e:
        print("retry without some kwargs:", e, flush=True)
        out = pipe(prompt=PROMPT, negative_prompt=NEG, num_frames=97)
    frames = out.frames[0]
    print(f"generated {len(frames)} frames in {time.time()-t0:.0f}s via {name}", flush=True)
    from diffusers.utils import export_to_video
    mp4 = os.path.join(OUT, "probe.mp4")
    export_to_video(frames, mp4, fps=24)
    frames[0].save(os.path.join(OUT, "probe_first.png"))
    frames[-1].save(os.path.join(OUT, "probe_last.png"))
    print("WROTE", mp4, "+ first/last PNG", flush=True)
    print("PROBE_OK", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("PROBE_FAIL", flush=True)
        sys.exit(1)
