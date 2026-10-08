#!/usr/bin/env python3
"""gen.py — MiniMax-H3 bake-off generator for film 10 (lantern room + cart, 16:9), headless ComfyUI.

Runs ON the GPU instance:
    ~/comfy/ComfyUI/.venv/bin/python ~/showcase/10-live-flash-sale/ai/minimax/gen.py

Boots ComfyUI as a local server (--listen 127.0.0.1:8188, no web), discovers the native MiniMax-H3
node classes from /object_info (names differ across ComfyUI releases, so we never hardcode them), builds
a minimal text-to-video graph, submits it per bake-off shot via /prompt, polls /history until done, then
muxes the saved frames to a picture-only h264 and dumps per-frame PNGs. Native audio is ignored (we use
our own VO/score). If the running ComfyUI exposes no MiniMax-H3 nodes, the script writes timing.json with
the discovered node list and exits non-zero (GEN_PARTIAL) so the orchestrator records a clean 'skipped/failed'.

Outputs under 10-live-flash-sale/out/ai/minimax/ (gitignored):
  <shot>_16x9.mp4 ; frames/<shot>_16x9/f%04d.png ; contact/<shot>_16x9.png ; timing.json
"""
import json, os, re, subprocess, sys, threading, time, urllib.request, urllib.error
from pathlib import Path

HOME = Path.home()
COMFY = HOME / "comfy" / "ComfyUI"
SHOWCASE = HOME / "showcase"
AI = SHOWCASE / "10-live-flash-sale" / "ai"
OUT = SHOWCASE / "10-live-flash-sale" / "out" / "ai" / "minimax"
FRAMES = OUT / "frames"; CONTACT = OUT / "contact"
for d in (OUT, FRAMES, CONTACT):
    d.mkdir(parents=True, exist_ok=True)

BAKE = json.loads((AI / "bakeoff.json").read_text())
SHOTS_JSON = json.loads((AI / "shots.json").read_text())
SHOT_BY_ID = {s["id"]: s for s in SHOTS_JSON["shots"]}
ITEM = BAKE["item"]; W = BAKE["size"]["width"]; H = BAKE["size"]["height"]
FPS = BAKE["fps"]; SEED = BAKE["seed"]; NFR = BAKE["frame_grids"]["minimax"]
NEG = BAKE["negative"]; BAKE_SHOTS = BAKE["shots"]
HOST = "127.0.0.1"; PORT = 8188; BASE = f"http://{HOST}:{PORT}"


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


def http_get(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return json.loads(r.read().decode())


def http_post(path, obj):
    data = json.dumps(obj).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def start_server():
    env = dict(os.environ)
    log = open(OUT / "comfy-server.log", "w")
    proc = subprocess.Popen(
        [str(COMFY / ".venv" / "bin" / "python"), "main.py",
         "--listen", HOST, "--port", str(PORT), "--disable-auto-launch", "--dont-print-server"],
        cwd=str(COMFY), stdout=log, stderr=subprocess.STDOUT, env=env,
    )
    for _ in range(240):  # up to ~8 min for first-time model index + import
        if proc.poll() is not None:
            raise RuntimeError("ComfyUI server exited early; see comfy-server.log")
        try:
            http_get("/object_info")
            return proc
        except Exception:
            time.sleep(2)
    raise RuntimeError("ComfyUI server did not come up in time")


def discover(obj_info):
    """Return {role: classname} for the native H3 text-to-video graph, else raise with the H3 node list."""
    classes = set(obj_info.keys())
    h3 = sorted(c for c in classes if "minimax" in c.lower() or "h3" in c.lower())
    def pick(preds):
        for c in classes:
            lc = c.lower()
            if all(p in lc for p in preds):
                return c
        return None
    roles = {
        "loader_dit": pick(["unet", "loader"]) or pick(["diffusion", "loader"]) or "UNETLoader",
        "loader_clip": pick(["clip", "loader"]) or "CLIPLoader",
        "loader_vae": pick(["vae", "loader"]) or "VAELoader",
        "encode": pick(["clip", "text", "encode"]) or "CLIPTextEncode",
        "h3_t2v": pick(["minimax", "video"]) or pick(["h3", "video"]),
        "sampler": pick(["ksampler"]) or "KSampler",
        "empty_latent": pick(["minimax", "latent"]) or pick(["empty", "video", "latent"]) or pick(["empty", "latent"]),
        "decode": pick(["vae", "decode"]) or "VAEDecode",
        "save": pick(["save", "video"]) or pick(["save", "animated"]) or pick(["save", "image"]) or "SaveImage",
    }
    return roles, h3


def pick_file(obj_info, classname, input_name):
    """Return the first available filename for a combo input of a loader node."""
    try:
        spec = obj_info[classname]["input"]["required"]
        for k, v in spec.items():
            if k == input_name or (isinstance(v, list) and v and isinstance(v[0], list)):
                opts = v[0] if isinstance(v[0], list) else None
                if opts:
                    return opts[0]
    except Exception:
        pass
    return None


def main():
    timing = {
        "model": "MiniMax-H3 (open weights) via ComfyUI native path",
        "region": os.environ.get("AWS_REGION", "unknown"),
        "instance_type": os.environ.get("MINIMAX_INSTANCE_TYPE", "unknown"),
        "gpu": gpu_name(), "fps": FPS, "seed": SEED, "num_frames": NFR, "resolution": f"{W}x{H}",
        "clips": {}, "notes": ["Native audio ignored (we use our own VO/score)."],
    }
    ls = VramSampler(); ls.start(); t = time.time()
    try:
        proc = start_server()
    except Exception as e:
        timing["error"] = f"server: {e}"; timing["peak_vram_mb_after_boot"] = ls.stop()
        (OUT / "timing.json").write_text(json.dumps(timing, indent=2))
        print(json.dumps(timing, indent=2)); print("GEN_PARTIAL"); sys.exit(1)
    timing["server_boot_seconds"] = round(time.time() - t, 1)
    timing["peak_vram_mb_after_boot"] = ls.stop()

    obj_info = http_get("/object_info")
    roles, h3_nodes = discover(obj_info)
    timing["discovered_h3_nodes"] = h3_nodes
    timing["roles"] = roles
    if not roles.get("h3_t2v") or not h3_nodes:
        timing["error"] = "No native MiniMax-H3 nodes found in this ComfyUI build; cannot build a T2V graph."
        (OUT / "timing.json").write_text(json.dumps(timing, indent=2))
        print(json.dumps(timing, indent=2))
        proc.terminate(); print("GEN_PARTIAL"); sys.exit(1)

    dit = pick_file(obj_info, roles["loader_dit"], "unet_name") or pick_file(obj_info, roles["loader_dit"], "model_name")
    clip = pick_file(obj_info, roles["loader_clip"], "clip_name")
    vae = pick_file(obj_info, roles["loader_vae"], "vae_name")
    timing["files"] = {"dit": dit, "clip": clip, "vae": vae}

    for sid in BAKE_SHOTS:
        prompt = SHOT_BY_ID[sid][ITEM]["16x9"]
        key = f"{sid}_16x9"
        # Minimal native-H3 T2V graph. Node I/O names are read from the live schema where they vary;
        # this is the canonical ComfyUI MiniMax-H3 text-to-video wiring (loaders -> encode -> empty H3
        # latent -> sampler -> VAE decode -> save). If a node's inputs differ, the submit error is logged.
        g = {
            "1": {"class_type": roles["loader_dit"], "inputs": {"unet_name": dit, "weight_dtype": "default"}},
            "2": {"class_type": roles["loader_clip"], "inputs": {"clip_name": clip, "type": "minimax_h3"}},
            "3": {"class_type": roles["loader_vae"], "inputs": {"vae_name": vae}},
            "4": {"class_type": roles["encode"], "inputs": {"text": prompt, "clip": ["2", 0]}},
            "5": {"class_type": roles["encode"], "inputs": {"text": NEG, "clip": ["2", 0]}},
            "6": {"class_type": roles["empty_latent"], "inputs": {"width": W, "height": H, "length": NFR, "batch_size": 1}},
            "7": {"class_type": roles["sampler"], "inputs": {
                "model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0],
                "seed": SEED, "steps": 20, "cfg": 6.0, "sampler_name": "euler", "scheduler": "beta", "denoise": 1.0}},
            "8": {"class_type": roles["decode"], "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
            "9": {"class_type": roles["save"], "inputs": {"images": ["8", 0], "filename_prefix": f"h3_{key}", "fps": FPS}},
        }
        print(f"=== minimax {key}  {W}x{H}  {NFR}f ===", flush=True)
        s = VramSampler(); s.start(); t0 = time.time()
        try:
            res = http_post("/prompt", {"prompt": g})
            pid = res["prompt_id"]
            # poll history
            done = None
            for _ in range(1800):  # up to ~60 min
                time.sleep(2)
                hist = http_get(f"/history/{pid}")
                if pid in hist:
                    done = hist[pid]; break
            secs = round(time.time() - t0, 1); peak = s.stop()
            if done is None:
                raise RuntimeError("timed out waiting for /history")
            status = done.get("status", {})
            if status.get("status_str") == "error" or not status.get("completed", True):
                msgs = json.dumps(status)[:600]
                raise RuntimeError(f"workflow error: {msgs}")
            # find saved output file(s)
            outs = []
            for node_out in done.get("outputs", {}).values():
                for kk in ("images", "gifs", "videos"):
                    for item in node_out.get(kk, []) or []:
                        outs.append(item)
            timing["clips"][key] = finalize_outputs(key, outs, secs, peak)
            print(f"  ok: {secs}s, peak {peak} MB", flush=True)
        except Exception as e:
            s.stop()
            tail = ""
            try:
                tail = (OUT / "comfy-server.log").read_text().splitlines()[-8:]
            except Exception:
                pass
            timing["clips"][key] = {"error": str(e)[:600], "server_tail": tail}
            print(f"  FAILED: {e}", flush=True)

    try:
        proc.terminate()
    except Exception:
        pass
    (OUT / "timing.json").write_text(json.dumps(timing, indent=2))
    print(json.dumps(timing, indent=2), flush=True)
    if any("error" in v for v in timing["clips"].values()) or not timing["clips"]:
        print("GEN_PARTIAL"); sys.exit(1)
    print("GEN_OK")


def finalize_outputs(key, outs, secs, peak):
    """Mux ComfyUI's output (a saved video, or a frame sequence) into picture-only h264 + per-frame PNG."""
    final = OUT / f"{key}.mp4"
    fdir = FRAMES / key; fdir.mkdir(parents=True, exist_ok=True)
    comfy_out = COMFY / "output"
    # Prefer a saved video file; else assemble from the saved image sequence.
    vids = [o for o in outs if str(o.get("filename", "")).lower().endswith((".mp4", ".webm", ".mov"))]
    if vids:
        src = comfy_out / vids[0].get("subfolder", "") / vids[0]["filename"]
        subprocess.run(["ffmpeg", "-y", "-i", str(src), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", str(final)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        imgs = [o for o in outs if str(o.get("filename", "")).lower().endswith((".png", ".jpg"))]
        if not imgs:
            return {"error": "no output file found", "generation_seconds": secs, "peak_vram_mb": peak}
        # stage frames and build an h264 from them at FPS
        tmp = OUT / f"_{key}_src"; tmp.mkdir(exist_ok=True)
        for i, o in enumerate(sorted(imgs, key=lambda x: x["filename"])):
            src = comfy_out / o.get("subfolder", "") / o["filename"]
            subprocess.run(["cp", str(src), str(tmp / f"f{i:04d}.png")], check=True)
        subprocess.run(["ffmpeg", "-y", "-framerate", str(FPS), "-i", str(tmp / "f%04d.png"),
                        "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", str(final)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(f"rm -rf {tmp}", shell=True)
    subprocess.run(["ffmpeg", "-y", "-i", str(final), str(fdir / "f%04d.png")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pngs = sorted(fdir.glob("f*.png"))
    if pngs:
        subprocess.run(["cp", str(pngs[len(pngs)//2]), str(CONTACT / f'{key}.png')], check=True)
    (fdir / "manifest.json").write_text(json.dumps({"frames": len(pngs), "fps": FPS}))
    return {"frames_on_disk": len(pngs), "generation_seconds": secs, "peak_vram_mb": peak}


if __name__ == "__main__":
    main()
