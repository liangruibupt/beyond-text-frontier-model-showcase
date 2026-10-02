#!/usr/bin/env python3
# Chinese narration via Kokoro-82M (the aws-is-how repo's method: KModel + KPipeline
# lang 'z', recommended male voice zm_yunjian) run LOCALLY in-process. One clip per
# scene; measure each; derive per-scene on-screen durations; assemble one narration
# track aligned to the animation timeline (title + scenes + fades). Dumps durations.json.
import json, os, subprocess, sys, time
import numpy as np, soundfile as sf
from kokoro import KModel, KPipeline

DIR = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(DIR, 'audio'); os.makedirs(AUD, exist_ok=True)
SCRATCH = os.environ.get('KIROCREW_SCRATCH')
FF = os.path.join(SCRATCH, 'ffmpeg-7.0.2-arm64-static', 'ffmpeg') if SCRATCH else 'ffmpeg'
if not os.path.exists(FF): FF = 'ffmpeg'
FFPROBE = os.path.join(os.path.dirname(FF), 'ffprobe')
if not os.path.exists(FFPROBE): FFPROBE = 'ffprobe'

SR = 24000
VOICE = os.environ.get('VOICE', 'zm_yunjian')   # recommended zh male voice
SPEED = float(os.environ.get('SPEED', '1.0'))
TITLE_MS = 2600; FADE_MS = 1000
LEAD_MS = 700; TAIL_MS = 1100

narr = json.load(open(os.path.join(DIR, 'narration.json')))

print(f'loading Kokoro (voice={VOICE}, speed={SPEED}) ...', file=sys.stderr)
t0 = time.time()
model = KModel(repo_id='hexgrad/Kokoro-82M').eval()
pipe = KPipeline(lang_code='z', repo_id='hexgrad/Kokoro-82M', model=model)
print(f'  loaded in {time.time()-t0:.1f}s', file=sys.stderr)

def synth(text, path):
    audio = np.concatenate([a for _, _, a in pipe(text, voice=VOICE, speed=SPEED)])
    sf.write(path, audio, SR)
    return len(audio) / SR * 1000.0  # ms

def dur_ms(path):
    out = subprocess.check_output([FFPROBE, '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', path]).decode().strip()
    return int(float(out) * 1000)

clips = []; durations = []
for s in narr:
    i = s['i']; wav = os.path.join(AUD, f'scene_{i:02d}.wav')
    d = int(synth(s['narr'], wav))
    clips.append((i, wav, d)); durations.append(LEAD_MS + d + TAIL_MS)
    print(f'scene {i:02d}: narr {d}ms -> body {durations[-1]}ms', file=sys.stderr)

json.dump(durations, open(os.path.join(DIR, 'durations.json'), 'w'))

idx = 0
def silence(ms):
    global idx
    p = os.path.join(AUD, f'sil_{idx}.wav'); idx += 1
    subprocess.run([FF, '-y', '-f', 'lavfi', '-i', f'anullsrc=r={SR}:cl=mono', '-t', f'{ms/1000.0}', p],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return p

seq = [silence(TITLE_MS)]
for (i, wav, d) in clips:
    seq += [silence(LEAD_MS), wav, silence(TAIL_MS + FADE_MS)]

listfile = os.path.join(AUD, 'concat.txt')
with open(listfile, 'w') as f:
    for p in seq: f.write(f"file '{p}'\n")
track = os.path.join(DIR, 'narration.wav')
subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', listfile, '-c', 'copy', track],
    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('TRACK', track, dur_ms(track), 'ms')
print('DURATIONS', durations)
