#!/usr/bin/env python3
# sfx.py — 07 开箱 ASMR 拟音：numpy 程序合成（确定性，无版权/下载依赖；WAV 用标准库 wave，无 scipy）。
# Video-Factory 场景 E 原设计即「Tape tearing and paper crinkling sounds are synthesized」。
# 生成 wav 到给定目录；post.py 在每镜头 hit point 混入。seed 固定 → 每次逐样本一致。
import os, sys, wave, numpy as np

SR = 48000

def _write_wav(path, y):
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def _read_wav(path):
    with wave.open(path, 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2')

def _env(n, attack, release):
    """attack/release 秒的线性包络，中间持平。"""
    a = int(attack * SR); r = int(release * SR); s = max(0, n - a - r)
    return np.concatenate([np.linspace(0, 1, a), np.ones(s), np.linspace(1, 0, r)])[:n] if n > a + r else np.hanning(n)

def _noise(n, rng):
    return rng.standard_normal(n).astype(np.float32)

def _bandish(x, lo=0.0, hi=1.0):
    """粗略频段整形：对白噪声做差分(高通)或累积(低通)的混合。"""
    hp = np.diff(x, prepend=x[:1])          # 高频强调
    lp = np.cumsum(x); lp -= lp.mean(); lp /= (np.abs(lp).max() + 1e-9)  # 低频强调
    return (1 - hi) * lp + hi * hp

def tape_rip(dur, rng):
    """胶带撕裂：密集高频噪声突发 + 轻微颗粒抖动，快起慢落。"""
    n = int(dur * SR); x = _noise(n, rng)
    x = _bandish(x, hi=0.85)                 # 偏高频"嗤——"
    grain = (rng.random(n) < 0.004).astype(np.float32) # 稀疏爆裂颗粒
    x = x + 2.5 * grain * _noise(n, rng)
    tremolo = 1 + 0.3 * np.sin(2 * np.pi * 55 * np.arange(n) / SR)  # 撕扯的锯齿感
    return x * tremolo * _env(n, 0.01, dur * 0.6)

def paper_crinkle(dur, rng):
    """纸/膜窸窣：中频噪声 + 随机微爆颗粒串，起伏多次。"""
    n = int(dur * SR); x = _bandish(_noise(n, rng), hi=0.55)
    bursts = np.zeros(n, np.float32)
    k = rng.integers(0, n, size=int(dur * 90))  # 密集"沙沙"颗粒
    bursts[k] = rng.standard_normal(len(k))
    x = 0.6 * x + 1.4 * bursts * _bandish(_noise(n, rng), hi=0.7)
    wob = 1 + 0.4 * np.sin(2 * np.pi * 3.5 * np.arange(n) / SR)  # 慢起伏
    return x * wob * _env(n, 0.02, dur * 0.4)

def whoosh(dur, rng):
    """升起气流：低中频噪声扫频，由弱渐强。"""
    n = int(dur * SR); x = _bandish(_noise(n, rng), hi=0.3)
    ramp = np.linspace(0.2, 1.0, n) ** 1.5
    return x * ramp * _env(n, dur * 0.3, dur * 0.3)

def chime(dur, rng):
    """定格叮：两枚泛音正弦衰减。"""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1760 * t) + 0.5 * np.sin(2 * np.pi * 2637 * t)
    return (y * np.exp(-t * 6)).astype(np.float32)

def bass_hum(dur, rng):
    """英雄垫底低频嗡鸣：低正弦 + 轻噪声。"""
    n = int(dur * SR); t = np.arange(n) / SR
    y = 0.7 * np.sin(2 * np.pi * 60 * t) + 0.2 * np.sin(2 * np.pi * 90 * t)
    y = y + 0.1 * _bandish(_noise(n, rng), hi=0.2)
    return (y * _env(n, 0.3, 0.6)).astype(np.float32)

FOLEY = {"tape": (tape_rip, 1.4), "crinkle": (paper_crinkle, 1.8), "whoosh": (whoosh, 1.6),
         "chime": (chime, 1.0), "hum": (bass_hum, 2.0)}
# 固定 seed（不用 hash()——PYTHONHASHSEED 随机化会破坏跨进程确定性）
SEED = {"tape": 101, "crinkle": 202, "whoosh": 303, "chime": 404, "hum": 505}

def render(name, out_path, gain=0.5):
    fn, dur = FOLEY[name]
    rng = np.random.default_rng(SEED[name])
    y = fn(dur, rng); y = y / (np.abs(y).max() + 1e-9) * gain
    _write_wav(out_path, y)
    return out_path

if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(d, exist_ok=True)
    for k in FOLEY:
        render(k, os.path.join(d, f"sfx_{k}.wav"))
    print("sfx written:", list(FOLEY))
