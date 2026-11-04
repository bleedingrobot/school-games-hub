"""Records Quick looks' read-aloud lines with Kokoro (Apache-2.0, https://github.com/hexgrad/kokoro).

The lines come from public/voice/quick-looks/lines.json, written by src/subitising/voiceLines.test.ts.
Only lines without a clip are recorded, unless --all is given (use it after changing VOICE or SPEED).

Kokoro lives outside the repo (it is about 340 MB):
    brew install uv
    mkdir ~/kokoro && cd ~/kokoro && uv venv --python 3.12 .venv
    uv pip install --python .venv/bin/python kokoro-onnx soundfile
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
Then, from the repo:
    ~/kokoro/.venv/bin/python -I scripts/quick-looks-voice.py [--all]
"""
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = 'af_bella'  # picked by James, 4 Nov 2026
LANG = 'en-us'
SPEED = 0.9
KOKORO = os.path.expanduser(os.environ.get('KOKORO_DIR', '~/kokoro'))
FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'voice', 'quick-looks')

WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']


def spoken(text: str) -> str:
    """What Kokoro reads: numbers as words, and "Yes! 5: 3 and 2." as "Yes! Five. Three and two."."""
    text = text.replace(': ', '. ')
    text = re.sub(r'\b(10|[0-9])\b', lambda m: WORDS[int(m.group(1))], text)
    return re.sub(r'(^|[.!?] )([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)


def trimmed(audio: np.ndarray, sr: int) -> np.ndarray:
    """Cut the silence at each end, keeping a short breath so the start isn't clipped."""
    loud = np.where(np.abs(audio) > 0.01)[0]
    if not len(loud):
        return audio
    pad = int(sr * 0.06)
    return audio[max(0, loud[0] - pad):loud[-1] + pad]


def main() -> None:
    redo = '--all' in sys.argv
    with open(os.path.join(FOLDER, 'lines.json')) as f:
        lines = json.load(f)
    todo = [l for l in lines if redo or not os.path.exists(os.path.join(FOLDER, l['slug'] + '.mp3'))]
    print(f'{len(todo)} of {len(lines)} lines to record with {VOICE}')
    if not todo:
        return
    kokoro = Kokoro(os.path.join(KOKORO, 'kokoro-v1.0.onnx'), os.path.join(KOKORO, 'voices-v1.0.bin'))
    for i, line in enumerate(todo, 1):
        audio, sr = kokoro.create(spoken(line['text']), voice=VOICE, speed=SPEED, lang=LANG)
        sf.write(os.path.join(FOLDER, line['slug'] + '.mp3'), trimmed(audio, sr), sr, format='MP3', compression_level=0.7)
        if i % 25 == 0 or i == len(todo):
            print(f'  {i}/{len(todo)}')


if __name__ == '__main__':
    main()
