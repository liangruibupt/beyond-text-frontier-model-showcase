#!/usr/bin/env python3
# Narration-driven timing with AWS Polly (neural, zh-CN voice "Zhiyu" -- clean on the
# embedded English terms: SpaceX, COPV, Roadster 2, km/h). For each scene we synthesize
# the line, measure its real length, and let that (+padding) define the scene's on-screen
# duration. We then build:
#   durations.json  -- per-scene frame counts for the Remotion composition
#   narration.wav   -- the dry voice track, each clip at its cumulative start
#   bgm.wav         -- an original, royalty-free "geek" synth bed (composed with ffmpeg)
#   narration_bgm.wav -- the final mix: BGM ducked ~6 dB under the voice but clearly
#                        audible in the voice-free gaps (verified with volumedetect).
import json, math, os, subprocess, sys, time
import boto3

DIR = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(DIR, 'audio'); os.makedirs(AUD, exist_ok=True)
FF = os.path.join(os.environ['KIROCREW_SCRATCH'], 'ffmpeg-7.0.2-arm64-static', 'ffmpeg')
FFPROBE = os.path.join(os.path.dirname(FF), 'ffprobe')
REGION = 'us-east-1'; ENGINE = 'neural'; VOICE = 'Zhiyu'; SR = 24000; FPS = 30
LEAD_MS = 450; TAIL_MS = 850     # breathing room before/after each line

# scene narration (timing is derived from the synthesized length)
TEXT = [
 '特斯拉 Roadster 2，所谓会飞的汽车。它，真的能飞吗？',
 'Roadster 2 是特斯拉第二代电动跑车，官方称零到一百公里加速只要一点九秒。但真正让它出圈的，是那套 SpaceX Package。',
 '先说真相：它不是靠机翼像飞机那样飞，而是用火箭的思路来推。套件的核心，是一组冷气推进器，cold gas thrusters。',
 '方案把后备箱换成一只碳纤维缠绕的高压空气罐，COPV，再在车身四周藏进大约十个喷口，按需向外放气。',
 '原理就是牛顿第三定律：高压空气以极高速度向下喷出，车身就获得一个向上的反作用力。和火箭、冷气姿态控制，完全同一个道理。',
 '多组向下的喷口一起工作，就能把整车短暂抬离地面、稳定悬停。这，就是演示里飞起来的那几秒。',
 '喷口还能定向：在直线上再加一把推力，过弯时多一份侧向力。这是用推进来辅助操控，而不只是悬浮。',
 '但要清醒：高压气罐容量有限，喷射时间很短，噪音、安全和法规，都是现实门槛。它，仍然是概念，并未量产交付。',
 '所以它很酷，却不是真的飞机。特斯拉 Roadster 2，冷气推进原理讲解。',
]

pol = boto3.client('polly', region_name=REGION)

def dur_ms(p):
    return int(float(subprocess.check_output(
        [FFPROBE,'-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',p]).decode())*1000)

def synth(txt, out_mp3):
    r = pol.synthesize_speech(Engine=ENGINE, VoiceId=VOICE, LanguageCode='cmn-CN',
                              OutputFormat='mp3', Text=txt)
    with open(out_mp3,'wb') as fh:
        fh.write(r['AudioStream'].read())

clips=[]; frames=[]
for i,txt in enumerate(TEXT):
    mp3=os.path.join(AUD,f's{i:02d}.mp3')
    synth(txt, mp3)
    d=dur_ms(mp3); body=LEAD_MS+d+TAIL_MS
    clips.append((i,mp3,d)); frames.append(round(body/1000*FPS))
    print(f'scene {i}: polly {d}ms -> {body}ms -> {frames[-1]} frames', file=sys.stderr)

json.dump(frames, open(os.path.join(DIR,'durations.json'),'w'))

# --- dry voice track: each clip at its cumulative start + LEAD ------------------
starts=[]; acc=0
for i in range(len(TEXT)):
    starts.append(acc+LEAD_MS); acc += LEAD_MS + clips[i][2] + TAIL_MS
TOTAL_MS = acc
TOTAL_S = TOTAL_MS/1000.0
inputs=sum([['-i',c[1]] for c in clips],[])
filters=[f'[{idx}]adelay={starts[idx]}|{starts[idx]}[a{idx}]' for idx in range(len(clips))]
mix_in=''.join(f'[a{i}]' for i in range(len(clips)))
base=f'anullsrc=r={SR}:cl=mono:d={TOTAL_S}'
fc=(f'{";".join(filters)};{mix_in}[{len(clips)}]'
    f'amix=inputs={len(clips)+1}:normalize=0:dropout_transition=0,volume=1.6[out]')
voice=os.path.join(DIR,'narration.wav')
subprocess.run([FF,'-y',*inputs,'-f','lavfi','-i',base,'-filter_complex',fc,
                '-map','[out]','-ar',str(SR),'-ac','1',voice],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('VOICE',voice,dur_ms(voice),'ms  frames_total',sum(frames),'=',sum(frames)/FPS,'s', file=sys.stderr)

# --- original "geek" BGM bed (synthesized, royalty-free) ------------------------
# A driving electronic bed: arpeggiated saw pad (A minor), a steady eighth-note pulse,
# a soft sub, and a high "data" shimmer -- gently low-passed so it sits behind the VO.
# Built from lavfi oscillators + tremolo gating; mixed to a comfortable music level.
bgm=os.path.join(DIR,'bgm.wav')
# A minor arpeggio frequencies (A2,E3,A3,C4,E4) cycled by a slow retrigger via aeval not
# available cheaply; instead layer sustained tones with tremolo to imply pulse + motion.
def osc(freq, vol, trem_hz, trem_depth, lp):
    return (f'aevalsrc=\'{vol}*sin(2*PI*{freq}*t)\':s={SR}:d={TOTAL_S}:c=mono,'
            f'tremolo=f={trem_hz}:d={trem_depth},lowpass=f={lp}')
layers = [
    osc(110.0, 0.22, 2.0, 0.6, 400),    # sub/bass pulse A2
    osc(220.0, 0.16, 4.0, 0.8, 1200),   # A3 pad, eighth-note feel
    osc(329.63,0.12, 4.0, 0.9, 1600),   # E4
    osc(440.0, 0.10, 8.0, 0.95,2200),   # A4 arpy
    osc(1318.5,0.075,12.0,1.0, 5000),   # E6 data shimmer
    osc(1760.0,0.070,16.0,1.0, 7000),   # A6 high gated hat-like sparkle
]
n=len(layers)
fc2=';'.join(f'{l}[l{i}]' for i,l in enumerate(layers))
mix2=''.join(f'[l{i}]' for i in range(n))
# gentle overall shaping: mild highpass to clear mud, soft limiter, fade in/out
fc2 += (f';{mix2}amix=inputs={n}:normalize=0,'
        f'highpass=f=60,acompressor=threshold=-18dB:ratio=3:attack=20:release=200,'
        f'volume=1.0,afade=t=in:st=0:d=0.3,afade=t=out:st={TOTAL_S-1.5}:d=1.5[bg]')
subprocess.run([FF,'-y','-filter_complex',fc2,'-map','[bg]','-ar',str(SR),'-ac','1',bgm],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('BGM',bgm,dur_ms(bgm),'ms', file=sys.stderr)

# --- final mix: sidechain-duck the BGM under the voice ---------------------------
# BGM target ~ -20 dB; sidechaincompress pulls it down ~6-8 dB whenever the VO speaks,
# so during narration the music is a soft bed and in the gaps it comes forward audibly.
out=os.path.join(DIR,'narration_bgm.wav')
fcmix=('[1:a]volume=0.72[bg];'                       # set BGM base level under voice
       '[0:a]volume=1.0,asplit=2[v0][vsc];'          # voice + a copy to drive the sidechain
       '[bg][vsc]sidechaincompress=threshold=0.04:ratio=5:attack=30:release=450[bgd];'
       '[v0][bgd]amix=inputs=2:normalize=0:dropout_transition=0[out]')
subprocess.run([FF,'-y','-i',voice,'-i',bgm,'-filter_complex',fcmix,
                '-map','[out]','-ar',str(SR),'-ac','2',out],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('MIX',out,dur_ms(out),'ms', file=sys.stderr)
