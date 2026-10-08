#!/usr/bin/env python3
"""post.py — 方式二后期合成（阶段1：裁剪 + xfade 拼接 + 片尾卡，16:9 15s，无字幕/无配音）。

读 boards.json（由 export_boards.mjs 从 meta.js 的 BOARDS 导出），把 gen/ltx_mp4/<shot>.mp4
按每款的镜头顺序裁成各自时长、用 xfade 做 dissolve/flash 转场拼接，末尾叠一张纯色片尾卡（end），
输出 16:9 1280x720 的 silent 成片到 out/films/jinshi_<scarf>_<cut>s_16x9_novo.mp4。

后续阶段：②drawtext 字幕 ③Kokoro 配音+混音 ④全变体(1x1/en/promo)。

用法：FFMPEG=/path/to/ffmpeg python3 post.py [--scarf qinghua] [--cut 15]
clip 实际 3.04s；剪辑表要的更长(如 qh_slip 3.75)时用 setpts 轻微慢放补足。
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # 06-silk-scarf/
FF = os.environ.get("FFMPEG") or "ffmpeg"
CLIPS = os.path.join(HERE, "ltx_mp4")
OUT = os.path.join(ROOT, "out", "films")
os.makedirs(OUT, exist_ok=True)

W, H, FPS = 1280, 720, 24                          # 16:9 交付分辨率（clip 是 704x480，放大+补边到 16:9）
CJK = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"   # 字幕中文字体
CAPS = json.load(open(os.path.join(HERE, "captions.json"))) if os.path.exists(os.path.join(HERE, "captions.json")) else {}

# 本机 ffmpeg（imageio）没有 drawtext 滤镜，所以字幕用 Pillow 预渲染成透明 PNG，再用 overlay 叠。
from PIL import Image, ImageDraw, ImageFont


def _hex2rgb(hexc):
    hexc = hexc.lstrip("#")
    return tuple(int(hexc[i:i + 2], 16) for i in (0, 2, 4))


def _text_png(text, size, color, out, maxw=None):
    """把一行/多行中文渲染成居中、带描边的透明 PNG（W×H 全画布，便于直接 overlay=0:0）。"""
    font = ImageFont.truetype(CJK, size)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    return img, d, font


def caption_png(scarf, shot, tmp, idx):
    """生成这一镜头字幕的全画布透明 PNG，返回路径；无字幕返回 None。"""
    kc = CAPS.get(scarf, {})
    cap = (kc.get("caps", {}).get(shot, {}) or {}).get("zh")
    if not cap:
        return None
    ink = _hex2rgb(kc.get("palette", {}).get("ink", "#f4e3c2")) + (255,)
    is_title = shot.endswith("_hero") or shot == "sj_box"
    size = 60 if is_title else 44
    font = ImageFont.truetype(CJK, size)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = int(W * 0.07)
    y = int(H * 0.70) if is_title else int(H * 0.80)
    d.text((x, y), cap, font=font, fill=ink, stroke_width=2, stroke_fill=(0, 0, 0, 170))
    p = os.path.join(tmp, f"cap_{idx}.png")
    img.save(p)
    return p


def endcard_png(scarf, tmp):
    """片尾卡文字层：锦时 + JINSHI + 标语，全画布透明 PNG，居中。"""
    kc = CAPS.get(scarf, {})
    ink = _hex2rgb(kc.get("palette", {}).get("ink", "#f4e3c2")) + (255,)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    def centered(text, size, cy):
        font = ImageFont.truetype(CJK, size)
        bb = d.textbbox((0, 0), text, font=font, stroke_width=2)
        d.text(((W - (bb[2] - bb[0])) / 2, cy), text, font=font, fill=ink, stroke_width=2, stroke_fill=(0, 0, 0, 150))
    centered("锦时", 96, int(H * 0.30))
    centered("JINSHI", 40, int(H * 0.46))
    centered("把纹样戴在身上", 36, int(H * 0.58))
    p = os.path.join(tmp, "endcard.png")
    img.save(p)
    return p
ONLY_SCARF = None
ONLY_CUT = None
for i, a in enumerate(sys.argv):
    if a == "--scarf": ONLY_SCARF = sys.argv[i + 1]
    if a == "--cut": ONLY_CUT = int(sys.argv[i + 1])


def sh(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:], flush=True)
        raise RuntimeError(f"ffmpeg failed rc={r.returncode}")
    return r


def clip_dur(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    for ln in r.stderr.splitlines():
        if "Duration" in ln:
            hms = ln.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(hms[0]) * 3600 + int(hms[1]) * 60 + float(hms[2])
    return 3.04


def prep_shot(shot, want, frm, tmp, scarf=None, idx=0):
    """裁一个镜头到 want 秒，缩放补边到 16:9，overlay 字幕 PNG（淡入），输出到 tmp。超长则慢放补足。"""
    src = os.path.join(CLIPS, f"{shot}.mp4")
    have = clip_dur(src) - frm
    out = os.path.join(tmp, f"{shot}.mp4")
    base_vf = f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,fps={FPS},setsar=1"
    cap_png = caption_png(scarf, shot, tmp, idx) if scarf else None
    slow = []
    if want > have + 0.05:
        base_vf = f"setpts={want/have:.4f}*PTS," + base_vf
    if cap_png:
        # 字幕 PNG 作第二输入；overlay 带淡入 alpha。基底先处理成 [bg]，叠加后输出。
        fc = (f"[0:v]{base_vf}[bg];"
              f"[1:v]format=rgba,fade=in:st=0:d=0.35:alpha=1[cap];"
              f"[bg][cap]overlay=0:0:format=auto[v]")
        args = [FF, "-y", "-ss", f"{frm}", "-i", src, "-loop", "1", "-i", cap_png,
                "-filter_complex", fc, "-map", "[v]", "-an", "-t", f"{want:.3f}",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    else:
        args = [FF, "-y", "-ss", f"{frm}", "-i", src, "-an", "-vf", base_vf, "-t", f"{want:.3f}",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    sh(args)
    return out


def end_card(dur, tmp, scarf=None):
    """片尾卡：深底 + overlay 文字 PNG（锦时/JINSHI/标语），整体淡入。"""
    out = os.path.join(tmp, "end.mp4")
    png = endcard_png(scarf, tmp) if scarf else None
    if png:
        fc = (f"color=c=0x1a1410:s={W}x{H}:r={FPS}:d={dur:.3f}[bg];"
              f"[1:v]format=rgba,fade=in:st=0:d=0.6:alpha=1[t];"
              f"[bg][t]overlay=0:0[v]")
        sh([FF, "-y", "-f", "lavfi", "-i", f"color=c=0x1a1410:s={W}x{H}:r={FPS}:d={dur:.3f}",
            "-loop", "1", "-i", png, "-filter_complex",
            f"[0:v]null[bg];[1:v]format=rgba,fade=in:st=0:d=0.6:alpha=1[t];[bg][t]overlay=0:0[v]",
            "-map", "[v]", "-t", f"{dur:.3f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out])
    else:
        sh([FF, "-y", "-f", "lavfi", "-i", f"color=c=0x1a1410:s={W}x{H}:r={FPS}:d={dur:.3f}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", out])
    return out


TTS_SH = "/home/ubuntu/workplace/aws-is-how/ai-ml/aigc/audio_models/Kokoro/tts.sh"
VO_VOICE_ZH = "zm_yunxi"   # lambda 实际支持的中文声音（captions 里的 zf_xiaoxiao lambda 没有）
VO_CACHE = os.path.join(HERE, "vo_cache")
os.makedirs(VO_CACHE, exist_ok=True)


def tts_line(text, voice, out):
    """调 Kokoro lambda 生成一句配音到 out(mp3)。缓存：同文本+声音不重复生成。"""
    import hashlib
    key = hashlib.md5(f"{voice}|{text}".encode()).hexdigest()[:12]
    cached = os.path.join(VO_CACHE, f"{key}.mp3")
    if not os.path.exists(cached):
        env = dict(os.environ, REGION="us-east-1", FUNC="kokoro-tts", PATH=os.environ["PATH"])
        r = subprocess.run(["bash", TTS_SH, voice, cached, text], capture_output=True, text=True, env=env)
        if r.returncode != 0 or not os.path.exists(cached):
            print(f"    TTS FAIL '{text[:16]}': {r.stderr[-200:]}", flush=True)
            return None
    import shutil
    shutil.copy(cached, out)
    return out


def mix_vo(video, scarf, cut, tmp):
    """按 captions.json 的 vo 台词，调 Kokoro 生成每句，按 at 时间点 adelay 混进视频音轨。返回有声 mp4。"""
    vo = CAPS.get(scarf, {}).get(f"vo{cut}_zh", [])
    if not vo:
        return video
    inputs, delays, labels = [], [], []
    n = 0
    for ln in vo:
        mp3 = tts_line(ln["text"], VO_VOICE_ZH, os.path.join(tmp, f"vo_{n}.mp3"))
        if not mp3:
            continue
        inputs += ["-i", mp3]
        at_ms = int(float(ln["at"]) * 1000)
        labels.append((n, at_ms))
        n += 1
    if n == 0:
        return video
    # filter: each vo input adelay to its 'at', then amix; map onto video
    fc = ""
    for idx, (vi, at_ms) in enumerate(labels):
        fc += f"[{idx+1}:a]adelay={at_ms}|{at_ms}[a{idx}];"
    mixlabels = "".join(f"[a{idx}]" for idx in range(n))
    fc += f"{mixlabels}amix=inputs={n}:normalize=0,alimiter=limit=0.9[aout]"
    out = os.path.join(tmp, "withvo.mp4")
    sh([FF, "-y", "-i", video, *inputs, "-filter_complex", fc,
        "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-shortest", out])
    return out


def build(scarf, cut, board, tmp):
    shots = board["shots"]
    parts, durs = [], []
    for i, e in enumerate(shots):
        if e["shot"] == "end":
            parts.append(end_card(e["dur"], tmp, scarf)); durs.append(e["dur"])
        else:
            parts.append(prep_shot(e["shot"], e["dur"], e.get("from", 0.0), tmp, scarf, i)); durs.append(e["dur"])
    trans = [e.get("transition") for e in shots]
    cur = parts[0]; cur_dur = durs[0]
    for i in range(1, len(parts)):
        t = trans[i] or {}
        xd = float(t.get("dur", 0)) if t.get("type") in ("dissolve", "flash") else 0.0
        xd = min(xd, cur_dur - 0.1, durs[i] - 0.1) if xd > 0 else 0.0
        nxt = os.path.join(tmp, f"m{i}.mp4")
        if xd <= 0:                                 # 硬切：concat
            lst = os.path.join(tmp, f"c{i}.txt")
            open(lst, "w").write(f"file '{cur}'\nfile '{parts[i]}'\n")
            sh([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", nxt])
            cur_dur = cur_dur + durs[i]
        else:
            off = cur_dur - xd
            mode = "fadewhite" if t.get("type") == "flash" else "fade"
            sh([FF, "-y", "-i", cur, "-i", parts[i], "-filter_complex",
                f"[0][1]xfade=transition={mode}:duration={xd:.3f}:offset={off:.3f},format=yuv420p[v]",
                "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), nxt])
            cur_dur = cur_dur + durs[i] - xd
        cur = nxt
    # 混配音：先得到无声成片，再把 Kokoro 台词按 at 混进音轨
    voiced = mix_vo(cur, scarf, cut, tmp)
    has_vo = voiced != cur
    name = f"jinshi_{scarf}_{cut}s_16x9{'' if has_vo else '_novo'}.mp4"
    final = os.path.join(OUT, name)
    sh([FF, "-y", "-i", voiced, "-c", "copy", "-movflags", "+faststart", final])
    print(f"OK {scarf} {cut}s -> {final} (~{cur_dur:.1f}s, vo={'yes' if has_vo else 'no'})", flush=True)
    return final


def main():
    boards = json.load(open(os.path.join(HERE, "boards.json")))
    made = []
    for scarf, cuts in boards.items():
        if ONLY_SCARF and scarf != ONLY_SCARF: continue
        for cut_s, board in cuts.items():
            cut = int(cut_s)
            if ONLY_CUT and cut != ONLY_CUT: continue
            with tempfile.TemporaryDirectory() as tmp:
                made.append(build(scarf, cut, board, tmp))
    print(f"POST_DONE films={len(made)}", flush=True)


if __name__ == "__main__":
    main()
