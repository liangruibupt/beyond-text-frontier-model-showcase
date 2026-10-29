#!/usr/bin/env python3
# Narration-driven timing: synthesize each scene via the Kokoro Lambda, measure it,
# and let the clip length (+padding) define that scene's on-screen duration. Dumps
# durations.json (per-scene frames) for the Remotion composition, and a voice track
# with each clip placed at its cumulative start so audio and visuals stay locked.
import json, os, subprocess, sys, time
import boto3

DIR = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(DIR, 'audio'); os.makedirs(AUD, exist_ok=True)
FF = os.path.join(os.environ['KIROCREW_SCRATCH'], 'ffmpeg-7.0.2-arm64-static', 'ffmpeg')
FFPROBE = os.path.join(os.path.dirname(FF), 'ffprobe')
REGION='us-east-1'; FUNC='kokoro-tts'; VOICE='zm_yunjian'; SR=24000; FPS=30
LEAD_MS=500; TAIL_MS=900   # breathing room before/after each line

# scene narration (timing is now derived from the synthesized length)
TEXT = [
 '特斯拉 Roadster 2，所谓会飞的汽车。它真的能飞吗？',
 'Roadster 2 是特斯拉第二代电动跑车，官方称百公里加速只要一点九秒。但真正让它出圈的，是那套 SpaceX 套件。',
 '先说真相：它不是靠机翼像飞机那样飞，而是用火箭的思路来推。套件的核心，是一组冷气推进器。',
 '方案把后备箱换成一只碳纤维缠绕的高压空气罐，再在车身四周藏进大约十个喷口，按需向外放气。',
 '原理就是牛顿第三定律：高压空气以极高速度向下喷出，车身就获得一个向上的反作用力。和火箭、冷气姿态控制完全同一个道理。',
 '多组向下的喷口一起工作，就能把整车短暂抬离地面、稳定悬停。这就是演示里飞起来的那几秒。',
 '喷口还能定向：在直线上再加一把推力，过弯时多一份侧向力。这是用推进来辅助操控，而不只是悬浮。',
 '但要清醒：高压气罐容量有限，喷射时间很短，噪音、安全和法规都是现实门槛。它仍是概念，并未量产交付。',
 '所以它很酷，却不是真的飞机。特斯拉 Roadster 2，冷气推进原理讲解。',
]

lam = boto3.client('lambda', region_name=REGION); s3 = boto3.client('s3', region_name=REGION)
def dur_ms(p): return int(float(subprocess.check_output([FFPROBE,'-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',p]).decode())*1000)
def invoke_tts(txt):
    for a in range(12):
        try:
            r=lam.invoke(FunctionName=FUNC, Payload=json.dumps({'text':txt,'voice':VOICE,'format':'mp3'}))
            return json.loads(r['Payload'].read())
        except lam.exceptions.ClientError as e:
            if any(k in str(e) for k in ('initializing','Pending','ResourceNotReady')):
                print(f'  cold start, wait 20s ({a+1})',file=sys.stderr); time.sleep(20); continue
            raise
    raise RuntimeError('Lambda not ready')

clips=[]; frames=[]
for i,txt in enumerate(TEXT):
    mp3=os.path.join(AUD,f's{i:02d}.mp3')
    b=invoke_tts(txt)
    if 'errorMessage' in b: raise RuntimeError(f'scene {i}: {b["errorMessage"]}')
    uri=b['s3_uri']; _,_,rest=uri.partition('s3://'); bk,_,key=rest.partition('/'); s3.download_file(bk,key,mp3)
    d=dur_ms(mp3); body=LEAD_MS+d+TAIL_MS; clips.append((i,mp3,d)); frames.append(round(body/1000*FPS))
    print(f'scene {i}: audio {d}ms -> {body}ms -> {frames[-1]} frames',file=sys.stderr)

json.dump(frames, open(os.path.join(DIR,'durations.json'),'w'))

# voice track: each clip at its cumulative start + LEAD
starts=[]; acc=0
for i in range(len(TEXT)):
    starts.append(acc+LEAD_MS); acc += LEAD_MS + clips[i][2] + TAIL_MS
TOTAL_MS = acc
inputs=sum([['-i',c[1]] for c in clips],[])
filters=[f'[{idx}]adelay={starts[idx]}|{starts[idx]}[a{idx}]' for idx in range(len(clips))]
mix_in=''.join(f'[a{i}]' for i in range(len(clips)))
base=f'anullsrc=r={SR}:cl=mono:d={TOTAL_MS/1000.0}'
fc=f'{";".join(filters)};{mix_in}[{len(clips)}]amix=inputs={len(clips)+1}:normalize=0:dropout_transition=0,volume=2.0[out]'
voice=os.path.join(DIR,'narration.wav')
subprocess.run([FF,'-y',*inputs,'-f','lavfi','-i',base,'-filter_complex',fc,'-map','[out]','-ar',str(SR),'-ac','1',voice],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print('VOICE',voice,dur_ms(voice),'ms  frames_total',sum(frames),'=',sum(frames)/FPS,'s')
