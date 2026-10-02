#!/usr/bin/env python3
# Chinese narration via the DEPLOYED Kokoro Lambda (arm64, zm_yunjian), per scene.
# Downloads each clip from S3, measures it, derives per-scene on-screen durations,
# builds a narration-only track AND a voice-dominant mix (quiet ambient bed).
import json, os, subprocess, sys, time, base64
import boto3

DIR = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(DIR, 'audio'); os.makedirs(AUD, exist_ok=True)
SCRATCH = os.environ.get('KIROCREW_SCRATCH')
FF = os.path.join(SCRATCH, 'ffmpeg-7.0.2-arm64-static', 'ffmpeg') if SCRATCH else 'ffmpeg'
if not os.path.exists(FF): FF = 'ffmpeg'
FFPROBE = os.path.join(os.path.dirname(FF), 'ffprobe')
if not os.path.exists(FFPROBE): FFPROBE = 'ffprobe'

REGION = 'us-east-1'; FUNC = 'kokoro-tts'; VOICE = os.environ.get('VOICE', 'zm_yunjian')
TITLE_MS = 3000; FADE_MS = 1200; LEAD_MS = 800; TAIL_MS = 1400
MUSIC_DB = float(os.environ.get('MUSIC_DB', '-24'))   # ambient bed level under the voice

narr = json.load(open(os.path.join(DIR, 'narration.json')))
lam = boto3.client('lambda', region_name=REGION)
s3 = boto3.client('s3', region_name=REGION)

def dur_ms(path):
    out = subprocess.check_output([FFPROBE,'-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path]).decode().strip()
    return int(float(out)*1000)

clips=[]; durations=[]
LOGO_HOLD_MS = 5000   # the final freeze-logo scene: draw + hold, silent
for s in narr:
    i=s['i']; mp3=os.path.join(AUD, f'scene_{i:02d}.mp3')
    if not (s.get('narr') or '').strip():
        # silent freeze scene (final logo): fixed-length silent clip, no TTS
        subprocess.run([FF,'-y','-f','lavfi','-i','anullsrc=r=24000:cl=mono','-t',f'{LOGO_HOLD_MS/1000.0}','-q:a','9',mp3],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        clips.append((i,mp3,LOGO_HOLD_MS)); durations.append(LEAD_MS+LOGO_HOLD_MS+TAIL_MS)
        print(f'scene {i:02d}: SILENT freeze logo -> body {durations[-1]}ms', file=sys.stderr)
        continue
    resp = lam.invoke(FunctionName=FUNC, Payload=json.dumps({'text':s['narr'],'voice':VOICE,'format':'mp3'}))
    body = json.loads(resp['Payload'].read())
    if 'errorMessage' in body: raise RuntimeError(f"scene {i} TTS failed: {body['errorMessage']}")
    uri = body['s3_uri']; _,_,rest = uri.partition('s3://'); bkt,_,key = rest.partition('/')
    s3.download_file(bkt, key, mp3)
    d=dur_ms(mp3); clips.append((i,mp3,d)); durations.append(LEAD_MS+d+TAIL_MS)
    print(f'scene {i:02d}: Lambda synth {body.get("synth_sec")}s, audio {d}ms -> body {durations[-1]}ms', file=sys.stderr)

json.dump(durations, open(os.path.join(DIR,'durations.json'),'w'))

idx=0
def silence(ms):
    global idx; p=os.path.join(AUD,f'sil_{idx}.mp3'); idx+=1
    subprocess.run([FF,'-y','-f','lavfi','-i','anullsrc=r=24000:cl=mono','-t',f'{ms/1000.0}','-q:a','9',p],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    return p
seq=[silence(TITLE_MS)]
for (i,mp3,d) in clips: seq += [silence(LEAD_MS), mp3, silence(TAIL_MS+FADE_MS)]
listfile=os.path.join(AUD,'concat.txt')
open(listfile,'w').write(''.join(f"file '{p}'\n" for p in seq))
voice=os.path.join(DIR,'narration.wav')
subprocess.run([FF,'-y','-f','concat','-safe','0','-i',listfile,'-ar','24000','-ac','1',voice],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
LEN=dur_ms(voice)/1000.0
print('VOICE_TRACK', voice, int(LEN*1000),'ms', file=sys.stderr)

# quiet ambient bed, well under the voice; voice stays at full level
bg=os.path.join(DIR,'bgmusic.wav')
subprocess.run([FF,'-y',
 '-f','lavfi','-i',f'sine=frequency=130.81:duration={LEN}',
 '-f','lavfi','-i',f'sine=frequency=196.00:duration={LEN}',
 '-f','lavfi','-i',f'sine=frequency=329.63:duration={LEN}',
 '-filter_complex',f'[0]volume=0.14[a];[1]volume=0.10[b];[2]volume=0.07[c];[a][b][c]amix=inputs=3:normalize=0,tremolo=f=0.12:d=0.4,lowpass=f=800,aformat=channel_layouts=mono,afade=t=in:st=0:d=5,afade=t=out:st={LEN-6}:d=6,volume={MUSIC_DB}dB[bg]',
 '-map','[bg]',bg],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
# mix: voice full, music ducked far under
mix=os.path.join(DIR,'narration_music.wav')
subprocess.run([FF,'-y','-i',voice,'-i',bg,
 '-filter_complex','[0]volume=1.0[v];[1]volume=1.0[m];[v][m]amix=inputs=2:duration=first:normalize=0[o]',
 '-map','[o]',mix],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print('MIX', mix, dur_ms(mix),'ms  music at', MUSIC_DB,'dB')
print('DURATIONS', durations)
