"""Records a game's read-aloud lines with Kokoro (Apache-2.0, https://github.com/hexgrad/kokoro).

The lines come from public/voice/<game>/lines.json, written by that game's voiceLines.test.ts
(quick-looks: src/subitising/, beanstalk: src/games/beanstalk/, hop: src/games/hop/,
pipi: src/games/pipi/, korora: src/games/korora/, weka: src/games/weka/, tui: src/games/tui/,
isles: src/games/isles/voice.test.ts). Only lines without a clip are
recorded, unless --all is given (use it after changing VOICE, SPEED or SAY_AS).

Kokoro lives outside the repo (it is about 340 MB):
    brew install uv
    mkdir ~/kokoro && cd ~/kokoro && uv venv --python 3.12 .venv
    uv pip install --python .venv/bin/python kokoro-onnx soundfile
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
Then, from the repo:
    ~/kokoro/.venv/bin/python -I scripts/voice-clips.py <quick-looks|beanstalk|hop|pipi|korora|weka|tui|isles> [--all]
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
VOICES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'voice')

# How Kokoro should say words it gets wrong: te reo Māori names, spelt the way they sound.
SAY_AS = {
    'Tūī': 'Too-ee',
    'Kererū': 'Keh-reh-roo',
    'Wētā': 'Wetta',  # the everyday Kiwi way (James, 4 Nov 2026)
    'Ruru': 'Roo-roo',
    'Takahē': 'Tah-kah-heh',
    'Kororā': 'Koh-roh-rah',
    'Hoiho': 'Hoy-ho',
    'Pūkeko': 'Poo-keh-koh',
    'Kākāpō': 'Kah-kah-poh',
    # Tūī's Ten Tree's friends (6 Nov 2026). Kākā after Kākāpō, so the longer name is replaced first.
    'Pīwakawaka': 'Pee-wah-kah-wah-kah',
    'Korimako': 'Koh-ree-mah-koh',
    'Kākā': 'Kah-kah',
    'kete': 'keh-teh',
    # Weka is left as written: Kokoro says it with a short e (wˈɛkə), as James asked on 5 Nov 2026; "Weh-kah" gave a long "way".
    # Te reo numbers (Weka's Stepping Stones and Tūī's Ten Tree): tekau mā whā is "ten and four". Longest first.
    'Tekau mā ': 'Teh-koh mah ',
    'Tekau': 'Teh-koh',
    'whā': 'fah',
    'whitu': 'fee-too',
    'Whitu': 'Fee-too',
    # Te reo: a short i like "pit", then a long "ee" (James, 5 Nov 2026). "Pippee" gives pˈɪpiː; "Peepee" gave two long ees.
    'Pipi': 'Pippee',
    'pipi': 'pippee',
}

ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']


def number(n: int) -> str:
    """Whole numbers to 1000 in words (the games say no others)."""
    if n <= 10:
        return ONES[n]
    if n == 1000:
        return 'one thousand'
    if n >= 100:
        rest = n % 100
        return ONES[n // 100] + ' hundred' + (' and ' + number(rest) if rest else '')
    if n < 20:
        return ['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'][n - 11]
    return TENS[n // 10] + ('-' + ONES[n % 10] if n % 10 else '')


def spoken(text: str) -> str:
    """What Kokoro reads: numbers as words, and "Yes! 5: 3 and 2." as "Yes! Five. Three and two."."""
    text = text.replace(': ', '. ')
    for word, say in SAY_AS.items():
        text = text.replace(word, say)
    text = re.sub(r'\d+', lambda m: number(int(m.group(0))), text)
    return re.sub(r'(^|[.!?] )([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)


def trimmed(audio: np.ndarray, sr: int) -> np.ndarray:
    """Cut the silence at each end, keeping a short breath so the start isn't clipped."""
    loud = np.where(np.abs(audio) > 0.01)[0]
    if not len(loud):
        return audio
    pad = int(sr * 0.06)
    return audio[max(0, loud[0] - pad):loud[-1] + pad]


def main() -> None:
    games = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(games) != 1:
        sys.exit('Which game? e.g. voice-clips.py beanstalk')
    folder = os.path.join(VOICES, games[0])
    redo = '--all' in sys.argv
    with open(os.path.join(folder, 'lines.json')) as f:
        lines = json.load(f)
    todo = [l for l in lines if redo or not os.path.exists(os.path.join(folder, l['slug'] + '.mp3'))]
    print(f'{games[0]}: {len(todo)} of {len(lines)} lines to record with {VOICE}')
    if not todo:
        return
    kokoro = Kokoro(os.path.join(KOKORO, 'kokoro-v1.0.onnx'), os.path.join(KOKORO, 'voices-v1.0.bin'))
    for i, line in enumerate(todo, 1):
        audio, sr = kokoro.create(spoken(line['text']), voice=VOICE, speed=SPEED, lang=LANG)
        sf.write(os.path.join(folder, line['slug'] + '.mp3'), trimmed(audio, sr), sr, format='MP3', compression_level=0.7)
        if i % 25 == 0 or i == len(todo):
            print(f'  {i}/{len(todo)}')


if __name__ == '__main__':
    main()
