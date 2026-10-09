#!/usr/bin/env python3
"""post.py — 方式二后期合成（完整版：裁剪 + xfade 转场 + 字幕 + 片尾卡 + Kokoro 配音混音）。

读 boards.json（BOARDS 剪辑表）+ captions.json（字幕/名称/配色/配音台词），把 gen/ltx_mp4/<shot>.mp4
按剪辑表拼成成片。支持 manifest.json 的全部 gallery 变体：
  ar   16x9(1280x720) / 1x1(1080x1080)
  lang zh / en
  promo none(标语) / launch(新品) / 1111(双11价签)
  cut  15 / 6
字幕用 Pillow 预渲染透明 PNG + ffmpeg overlay（本机 ffmpeg 无 drawtext）。
配音调 Kokoro lambda（zf_xiaoxiao / bf_emma），按 at 时间点 adelay 混入。

用法：FFMPEG=... python3 post.py [--only 15_zh_none|15_en_launch|6_zh_1111] [--scarf qinghua]
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FF = os.environ.get("FFMPEG") or "ffmpeg"
CLIPS = os.path.join(HERE, "ltx_mp4")
OUT = os.path.join(ROOT, "out", "films")
os.makedirs(OUT, exist_ok=True)
FPS = 24
CJK = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
CAPS = json.load(open(os.path.join(HERE, "captions.json")))
BOARDS = json.load(open(os.path.join(HERE, "boards.json")))

VO_VOICE = {"zh": "zf_xiaoxiao", "en": "bf_emma"}   # lambda 实际支持（tts.sh 注释漏列 zf_/bf_）
TTS_SH = "/home/ubuntu/workplace/aws-is-how/ai-ml/aigc/audio_models/Kokoro/tts.sh"
VO_CACHE = os.path.join(HERE, "vo_cache"); os.makedirs(VO_CACHE, exist_ok=True)

# gallery 的三组变体（见 manifest.json）
GROUPS = {
    "15_zh_none":   dict(cut=15, lang="zh", promo="none",   ar="16x9", W=1280, H=720),
    "15_en_launch": dict(cut=15, lang="en", promo="launch", ar="16x9", W=1280, H=720),
    "6_zh_1111":    dict(cut=6,  lang="zh", promo="1111",   ar="1x1",  W=1080, H=1080),
}


def sh(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:], flush=True); raise RuntimeError(f"ffmpeg rc={r.returncode}")
    return r


def _rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def clip_dur(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    for ln in r.stderr.splitlines():
        if "Duration" in ln:
            x = ln.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(x[0]) * 3600 + int(x[1]) * 60 + float(x[2])
    return 3.04


def _font(size): return ImageFont.truetype(CJK, size)


def caption_png(scarf, shot, lang, V, tmp, idx):
    cap = (CAPS[scarf]["caps"].get(shot, {}) or {}).get(lang)
    if not cap:
        return None
    W, H = V["W"], V["H"]
    ink = _rgb(CAPS[scarf]["palette"].get("ink", "#f4e3c2")) + (255,)
    is_title = shot.endswith("_hero") or shot == "sj_box"
    size = int((60 if is_title else 44) * (W / 1280.0))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    y = int(H * (0.70 if is_title else 0.80))
    d.text((int(W * 0.07), y), cap, font=_font(size), fill=ink, stroke_width=2, stroke_fill=(0, 0, 0, 170))
    p = os.path.join(tmp, f"cap_{idx}.png"); img.save(p); return p


def endcard_png(scarf, lang, promo, V, tmp):
    """片尾卡文字：锦时/JINSHI + 按 promo 的标语/新品/双11价签。"""
    W, H = V["W"], V["H"]
    k = CAPS[scarf]; pal = k["palette"]
    # 片尾卡是统一深底(#1a1410)，深色系的款(青花/宋锦 ink 是深蓝)会看不清，所以片尾统一用暖白亮字
    ink = (244, 227, 194, 255)
    red = (225, 37, 27, 255)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    sc = W / 1280.0
    def centered(text, size, cy, fill=ink):
        f = _font(int(size * sc)); bb = d.textbbox((0, 0), text, font=f, stroke_width=2)
        d.text(((W - (bb[2] - bb[0])) / 2, cy), text, font=f, fill=fill, stroke_width=2, stroke_fill=(0, 0, 0, 150))
    centered("锦时", 92, int(H * 0.26))
    centered("JINSHI", 38, int(H * 0.40))
    name = k["name"][lang]
    if promo == "1111":
        d_price = k["deal"]["CNY" if lang == "zh" else "USD"]
        centered(name, 40, int(H * 0.50))
        centered("双11 到手价" if lang == "zh" else "Double 11", 34, int(H * 0.60), red)
        centered((f"¥{d_price}" if lang == "zh" else f"${d_price}"), 72, int(H * 0.68), red)
    elif promo == "launch":
        centered(("新品首发 " if lang == "zh" else "New Arrival") + name, 36, int(H * 0.52))
        centered(k["cta"][lang], 34, int(H * 0.62), _rgb(pal.get("cta", "#c99a3b")) + (255,))
    else:
        centered(k["tagline"][lang], 36, int(H * 0.52))
    p = os.path.join(tmp, "endcard.png"); img.save(p); return p


def prep_shot(shot, want, frm, scarf, lang, V, tmp, idx):
    src = os.path.join(CLIPS, f"{shot}.mp4")
    have = clip_dur(src) - frm
    out = os.path.join(tmp, f"s{idx}.mp4")
    W, H = V["W"], V["H"]
    base = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1"
    if want > have + 0.05:
        base = f"setpts={want/have:.4f}*PTS," + base
    cap = caption_png(scarf, shot, lang, V, tmp, idx)
    if cap:
        fc = f"[0:v]{base}[bg];[1:v]format=rgba,fade=in:st=0:d=0.35:alpha=1[c];[bg][c]overlay=0:0[v]"
        args = [FF, "-y", "-ss", f"{frm}", "-i", src, "-loop", "1", "-i", cap, "-filter_complex", fc,
                "-map", "[v]", "-an", "-t", f"{want:.3f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    else:
        args = [FF, "-y", "-ss", f"{frm}", "-i", src, "-an", "-vf", base, "-t", f"{want:.3f}",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out]
    sh(args); return out


def end_card(dur, scarf, lang, promo, V, tmp):
    W, H = V["W"], V["H"]
    png = endcard_png(scarf, lang, promo, V, tmp)
    out = os.path.join(tmp, "end.mp4")
    sh([FF, "-y", "-f", "lavfi", "-i", f"color=c=0x1a1410:s={W}x{H}:r={FPS}:d={dur:.3f}", "-loop", "1", "-i", png,
        "-filter_complex", "[0:v]null[bg];[1:v]format=rgba,fade=in:st=0:d=0.6:alpha=1[t];[bg][t]overlay=0:0[v]",
        "-map", "[v]", "-t", f"{dur:.3f}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), out])
    return out


def tts_line(text, voice, out):
    key = hashlib.md5(f"{voice}|{text}".encode()).hexdigest()[:12]
    cached = os.path.join(VO_CACHE, f"{key}.mp3")
    if not os.path.exists(cached):
        env = dict(os.environ, REGION="us-east-1", FUNC="kokoro-tts")
        r = subprocess.run(["bash", TTS_SH, voice, cached, text], capture_output=True, text=True, env=env)
        if r.returncode != 0 or not os.path.exists(cached):
            print(f"    TTS FAIL '{text[:16]}': {r.stderr[-160:]}", flush=True); return None
    shutil.copy(cached, out); return out


def mix_vo(video, scarf, vo_key, lang, tmp):
    vo = CAPS[scarf]["vo"].get(vo_key, [])
    if not vo:
        return video, False
    inputs, labels, n = [], [], 0
    for ln in vo:
        mp3 = tts_line(ln["text"], VO_VOICE[lang], os.path.join(tmp, f"vo{n}.mp3"))
        if not mp3:
            continue
        inputs += ["-i", mp3]; labels.append(int(float(ln["at"]) * 1000)); n += 1
    if n == 0:
        return video, False
    fc = "".join(f"[{i+1}:a]adelay={ms}|{ms}[a{i}];" for i, ms in enumerate(labels))
    fc += "".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,alimiter=limit=0.9[aout]"
    out = os.path.join(tmp, "wv.mp4")
    sh([FF, "-y", "-i", video, *inputs, "-filter_complex", fc, "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-shortest", out])
    return out, True


def build(scarf, group_key, tmp):
    V = GROUPS[group_key]
    cut, lang, promo = V["cut"], V["lang"], V["promo"]
    board = BOARDS[scarf][str(cut)]
    shots = board["shots"]
    parts, durs = [], []
    for i, e in enumerate(shots):
        if e["shot"] == "end":
            parts.append(end_card(e["dur"], scarf, lang, promo, V, tmp)); durs.append(e["dur"])
        else:
            parts.append(prep_shot(e["shot"], e["dur"], e.get("from", 0.0), scarf, lang, V, tmp, i)); durs.append(e["dur"])
    trans = [e.get("transition") for e in shots]
    cur, cur_dur = parts[0], durs[0]
    for i in range(1, len(parts)):
        t = trans[i] or {}
        xd = float(t.get("dur", 0)) if t.get("type") in ("dissolve", "flash") else 0.0
        xd = min(xd, cur_dur - 0.1, durs[i] - 0.1) if xd > 0 else 0.0
        nxt = os.path.join(tmp, f"m{i}.mp4")
        if xd <= 0:
            lst = os.path.join(tmp, f"c{i}.txt"); open(lst, "w").write(f"file '{cur}'\nfile '{parts[i]}'\n")
            sh([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", nxt]); cur_dur += durs[i]
        else:
            mode = "fadewhite" if t.get("type") == "flash" else "fade"
            sh([FF, "-y", "-i", cur, "-i", parts[i], "-filter_complex",
                f"[0][1]xfade=transition={mode}:duration={xd:.3f}:offset={cur_dur-xd:.3f},format=yuv420p[v]",
                "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), nxt]); cur_dur += durs[i] - xd
        cur = nxt
    voiced, has = mix_vo(cur, scarf, group_key, lang, tmp)
    promo_tag = "" if promo == "none" else f"_{promo}"
    name = f"kaiwu_{scarf}_{cut}s_{V['ar']}_{lang}{promo_tag}.mp4"
    final = os.path.join(OUT, name)
    sh([FF, "-y", "-i", voiced, "-c", "copy", "-movflags", "+faststart", final])
    print(f"OK {name} (~{cur_dur:.1f}s vo={'y' if has else 'n'})", flush=True)
    return final


def main():
    only_group = only_scarf = None
    for i, a in enumerate(sys.argv):
        if a == "--only": only_group = sys.argv[i + 1]
        if a == "--scarf": only_scarf = sys.argv[i + 1]
    made = []
    for g in GROUPS:
        if only_group and g != only_group:
            continue
        for scarf in BOARDS:
            if only_scarf and scarf != only_scarf:
                continue
            with tempfile.TemporaryDirectory() as tmp:
                made.append(build(scarf, g, tmp))
    print(f"POST_DONE films={len(made)}", flush=True)


if __name__ == "__main__":
    main()
