#!/usr/bin/env python
# probe_ltx_distilled.py — 蒸馏版验证：完整 LTX-2.5 base + distilled LoRA + 8 步少步数，测实际单条速度。
# 只回传 PNG（首帧/尾帧截图），不回传视频。
# 用法：HF_TOKEN=... HF_HOME=/opt/dlami/nvme/hf python probe_ltx_distilled.py
import os, sys, time, traceback
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
import torch

REPO = os.environ.get("LTX_REPO", "Lightricks/LTX-2.5-Diffusers")
# 蒸馏 LoRA 就在 repo 根目录
LORA_FILE = os.environ.get("LTX_LORA", "ltx-2.5-22b-distilled-lora-450-bf16.safetensors")
OUT = os.environ.get("OUT", "/opt/dlami/nvme/ltx-src/probe")
STEPS = int(os.environ.get("STEPS", "8"))
GUID = float(os.environ.get("GUID", "1.0"))
os.makedirs(OUT, exist_ok=True)
PROMPT = ("A luxury silk scarf product shot: a calligraphy brush paints a flowing blue cobalt "
          "lotus scroll onto white porcelain, ink blooming and spreading in cinematic macro, "
          "soft studio light, elegant, high detail, slow graceful camera push-in, real footage")
NEG = "worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark, logo"

def load():
    import diffusers
    print("diffusers", diffusers.__version__, flush=True)
    from diffusers import AutoModel
    transformer = None
    if os.environ.get("FP8", "0") == "1":
        try:
            transformer = AutoModel.from_pretrained(REPO, subfolder="transformer", torch_dtype=torch.bfloat16)
            transformer.enable_layerwise_casting(storage_dtype=torch.float8_e4m3fn, compute_dtype=torch.bfloat16)
            print("transformer: fp8 layerwise casting on", flush=True)
        except Exception as e:
            print("fp8 cast unavailable:", str(e)[:160], flush=True)
    else:
        print("fp8 casting disabled (bf16) — required for clean LoRA math", flush=True)
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

def apply_lora(pipe):
    try:
        t0 = time.time()
        pipe.load_lora_weights(REPO, weight_name=LORA_FILE, adapter_name="distilled")
        try:
            pipe.set_adapters(["distilled"], adapter_weights=[1.0])
        except Exception:
            pass
        print(f"distilled LoRA loaded ({LORA_FILE}) in {time.time()-t0:.0f}s", flush=True)
        return True
    except Exception as e:
        print("LoRA load FAILED:", type(e).__name__, str(e)[:300], flush=True)
        return False

def main():
    name, pipe = load()
    lora_ok = apply_lora(pipe)
    # 蒸馏 + 少步 + 无 CFG，工作集更轻。bf16(无 fp8) transformer 更大，优先 sequential 保证装得下；
    # 开了 fp8 则优先更快的 model offload。
    if os.environ.get("FP8", "0") == "1":
        order = ("enable_model_cpu_offload", "enable_sequential_cpu_offload")
    else:
        order = ("enable_sequential_cpu_offload", "enable_model_cpu_offload")
    moved = False
    for m in order:
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
              num_frames=73, num_inference_steps=STEPS, guidance_scale=GUID,
              generator=torch.Generator("cuda").manual_seed(7))
    try:
        out = pipe(**kw)
    except torch.cuda.OutOfMemoryError:
        print("model offload OOM — falling back to sequential offload", flush=True)
        # 重新加载更省显存的路径
        try: pipe.enable_sequential_cpu_offload()
        except Exception: pass
        torch.cuda.empty_cache()
        out = pipe(**kw)
    except TypeError as e:
        print("retry without some kwargs:", e, flush=True)
        out = pipe(prompt=PROMPT, negative_prompt=NEG, num_frames=73,
                   num_inference_steps=STEPS, guidance_scale=GUID)
    dt = time.time() - t0
    frames = out.frames[0]
    print(f"generated {len(frames)} frames in {dt:.0f}s via {name} (steps={STEPS}, guid={GUID}, lora={lora_ok})", flush=True)
    print(f"SPEED {dt:.0f}s/clip", flush=True)
    from diffusers.utils import export_to_video
    mp4 = os.path.join(OUT, "probe_distilled.mp4")
    export_to_video(frames, mp4, fps=24)
    frames[0].save(os.path.join(OUT, "probe_d_first.png"))
    frames[-1].save(os.path.join(OUT, "probe_d_last.png"))
    print("WROTE", mp4, "+ first/last PNG", flush=True)
    print("PROBE_OK", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("PROBE_FAIL", flush=True)
        sys.exit(1)
