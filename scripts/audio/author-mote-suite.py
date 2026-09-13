#!/usr/bin/env python3
"""Original procedural Mote score: damped wood, glass seeds, spring and air.

No sampled or third-party audio. Deterministic PCM masters are the editable
source; this synthesis recipe preserves every note, envelope and mix decision.
Run from anywhere. --check verifies existing assets without rewriting them.
"""
import hashlib
import json
import math
from pathlib import Path
import random
import struct
import sys
import wave

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/sounds/mote-machine'
RATE = 44100
TAU = math.tau


def render(name, duration, notes=(), wood=(), air=0, loop=False, peak=0.4):
    rng = random.Random(name)
    count = round(duration * RATE)
    values = [0.0] * count
    filtered = 0
    for i in range(count):
        t = i / RATE
        filtered = filtered * .97 + rng.uniform(-1, 1) * .03
        env = (0.65 + .35 * math.cos(TAU * t / duration)) if loop else math.sin(math.pi * t / duration) ** 2
        values[i] = filtered * air * env
    for start, frequency, length, gain in notes:
        for j in range(min(round(length * RATE), count - round(start * RATE))):
            t = j / RATE
            env = min(1, t / .007) * math.exp(-5 * t / length) * min(1, (length-t)/.025)
            tone = math.sin(TAU * frequency * t) + .28 * math.sin(TAU * frequency * 2.003 * t) + .08 * math.sin(TAU * frequency * 3.99 * t)
            values[round(start * RATE) + j] += gain * env * tone
    for start, frequency, length, gain in wood:
        for j in range(min(round(length * RATE), count - round(start * RATE))):
            t = j / RATE
            env = min(1, t / .002) * math.exp(-7 * t / length)
            tone = .7 * math.sin(TAU * frequency * t) + .3 * math.sin(TAU * frequency * 1.47 * t) + .16 * rng.uniform(-1, 1)
            values[round(start * RATE) + j] += gain * env * tone
    # Small room reflection, never a long casino reverb tail.
    delay = round(.037 * RATE)
    dry = values[:]
    for i in range(delay, count):
        values[i] += dry[i-delay] * .09
    maximum = max(abs(x) for x in values) or 1
    values = [x * min(1, peak / maximum) for x in values]
    # Endpoints at silence make optional loops click-free.
    fade = round(.015 * RATE)
    for i in range(fade):
        values[i] *= i / fade
        values[-i-1] *= i / fade
    pcm = struct.pack('<' + 'h' * count, *(round(x * 32767) for x in values))
    path = OUT / (name + '.wav')
    if '--check' not in sys.argv:
        with wave.open(str(path), 'wb') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(RATE)
            f.writeframes(pcm)
    with wave.open(str(path), 'rb') as f:
        assert f.getframerate() == RATE and f.getnchannels() == 1
        assert f.readframes(f.getnframes()) == pcm, name + ': source differs'
    rms = math.sqrt(sum(x*x for x in values) / count)
    assert rms > .0001 and max(abs(x) for x in values) < .6
    return {'cue':name, 'file':path.name, 'duration_ms':round(duration*1000),
            'loop':loop, 'peak_dbfs':round(20*math.log10(max(abs(x) for x in values)),2),
            'rms_dbfs':round(20*math.log10(rms),2),
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def n(start, hz, length=.38, gain=.15):
    return (start, hz, length, gain)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    def cue(*args, **kwargs):
        rows.append(render(*args, **kwargs))
    cue('room_tone', 4, air=.18, loop=True, peak=.08)
    cue('mote_ready', .65, [n(.02, 880, .5, .09), n(.11,1320,.45,.035)])
    cue('deposit_1', .42, [n(.01,1046,.3,.13)], [n(.075,190,.22,.18)])
    cue('deposit_bundle', .48, [n(.01,880,.3,.09), n(.045,1046,.3,.1), n(.08,1320,.3,.07)], [n(.11,170,.28,.21)])
    cue('lever_down', .32, wood=[n(.01,140,.24,.38),n(.055,260,.2,.12)])
    cue('lever_return', .42, [n(.015,370,.34,.1),n(.05,540,.29,.06)], [n(.01,240,.18,.2)])
    cue('reel_start', .45, wood=[n(.02+i*.055,180+i*16,.12,.12) for i in range(6)], air=.08)
    cue('reel_loop', .8, wood=[n(.025+i*.075,230+(i%3)*27,.1,.055) for i in range(10)], air=.09, loop=True)
    for i, freq in enumerate([175,198,220],1):
        cue(f'reel_stop_{i}', .32, wood=[n(.01,freq,.25,.30),n(.04,freq*2,.16,.09)])
    cue('loss', .6, wood=[n(.02,130,.36,.13)], air=.15, peak=.16)
    cue('stake_returned', .65, [n(.02,660,.38,.10),n(.13,660,.36,.05)], [n(.04,180,.2,.08)], peak=.19)
    for name, melody, duration in [
        ('small',[523,659],.8), ('medium',[523,659,784],.95),
        ('big',[523,659,784,1046],1.2),
        ('jackpot',[523,659,784,1046,784,1318],1.95)]:
        notes = [n(.02+i*.14,hz,.55,.16 if i==0 else .12) for i,hz in enumerate(melody)]
        if name=='jackpot':
            notes += [n(.88,523,.85,.085),n(.88,784,.85,.07),n(.88,1046,.85,.065)]
        cue(name,duration,notes,peak=.32)
    cue('acorn_award',.55,[n(.04,1175,.42,.10)], [n(.01,310,.14,.22),n(.09,400,.12,.12)])
    cue('first_unlock',.9,[n(.05,659,.45,.10),n(.23,784,.45,.10),n(.41,1046,.45,.10)], [n(.01,230,.17,.15),n(.18,290,.14,.1)])
    cue('receipt_replay',.65,[n(.02,784,.45,.055),n(.14,659,.42,.065)],air=.045,peak=.13)
    cue('recovery_ok',.4,[n(.015,659,.32,.055)],peak=.12)
    cue('recovery_error',.45,wood=[n(.02,170,.30,.09)],air=.04,peak=.12)
    manifest = {'version':'mote-audio-v1','sample_rate':RATE,'channels':1,
        'source':'scripts/audio/author-mote-suite.py',
        'authorship':'Original deterministic synthesis; no third-party samples.', 'cues':rows}
    target=OUT/'manifest.json'
    if '--check' not in sys.argv:
        target.write_text(json.dumps(manifest,indent=2)+'\n')
    else:
        assert json.loads(target.read_text()) == manifest
    print(f'PASS: {len(rows)} audible, source-matched PCM cues; bounded peaks and silent endpoints.')


if __name__ == '__main__':
    main()
