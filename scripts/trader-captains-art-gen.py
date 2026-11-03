#!/usr/bin/env python3
"""
Paints Star Trader's starship captains (20 men, 20 women) in ComfyUI on James's gaming PC, so a pupil can pick the captain who
flies their ship. Runs on a computer that can reach ComfyUI on Tailscale (http://100.97.96.115:8188), never in the site build.
Needs only the Python standard library.

  python3 scripts/trader-captains-art-gen.py           # paint every captain not in the inbox yet
  python3 scripts/trader-captains-art-gen.py --list    # every captain and their prompt, nothing is painted

All the captains are sent to ComfyUI's queue at once (so they wait behind anything already painting), then the script waits
and saves each one to ~/dragon-art-inbox/trader-captains/<key>.png with the prompt stored inside the PNG. A captain already
in the inbox is skipped, so it can be run again after a stop. Seeds are fixed from the captain's key.

Same graph as scripts/trader-forge-art-gen.py (Z-Image Turbo, 8 steps, 1.5x second pass: 1024x1024 becomes 1536x1536).
The model has no negative prompt, so every prompt says what is there, never what is not.
"""
from __future__ import annotations

import json
import struct
import sys
import time
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'
INBOX = Path.home() / 'dragon-art-inbox' / 'trader-captains'

STYLE = ('Friendly animated film character portrait, polished 3D family adventure movie style, warm and kind expression, '
         'suitable for children aged 8 to 12. ')
TAIL = (' Head and shoulders portrait, facing the viewer, centred, softly lit, a starship bridge with glowing screens and stars '
        'gently blurred behind, square picture, smart starship captain uniform fully covering the shoulders.')

# key: the captain's own words. Ages, looks and backgrounds vary on purpose so every pupil can find someone they like.
CAPTAINS = {
    # ---- men ----
    'm01': 'a young captain with short curly black hair and dark brown skin, a big confident grin, navy blue uniform with gold trim',
    'm02': 'a cheerful older captain with a neat white beard and pale skin, kind blue eyes, deep red uniform with silver stars',
    'm03': 'a young East Asian captain with spiky black hair and a headset microphone, bright teal uniform',
    'm04': 'a Māori captain with a warm smile, short dark hair and a carved greenstone pendant, black and silver uniform',
    'm05': 'a South Asian captain with a tidy dark beard and a navy turban, calm wise smile, white and gold uniform',
    'm06': 'a red-haired freckled young captain with goggles pushed up on his forehead, orange and grey pilot jacket',
    'm07': 'a tall captain with a shaved head and dark skin, round glasses, thoughtful smile, purple uniform',
    'm08': 'a Pacific Islander captain with long wavy black hair tied back, broad friendly smile, ocean blue uniform',
    'm09': 'a Latino captain with a thick moustache and laughing eyes, green uniform with a captain\'s badge',
    'm10': 'a grandfatherly captain with silver hair and a captain\'s peaked cap, olive skin, crimson uniform',
    'm11': 'a young blond captain with a quiff hairstyle and a cheeky wink, sky blue uniform',
    'm12': 'a Middle Eastern captain with short wavy dark hair and a trimmed beard, gentle smile, sand coloured uniform',
    'm13': 'a friendly green-skinned alien captain with large dark eyes and two small antennae, silver uniform',
    'm14': 'a captain who is a brave robot with a rounded shiny blue metal head, glowing friendly eyes, captain\'s sash',
    'm15': 'a young captain with dreadlocks tied up, brown skin, an excited smile, yellow and black uniform',
    'm16': 'a Japanese captain with neat grey hair and a calm smile, deep navy uniform with a white collar',
    'm17': 'a captain with a cybernetic glowing blue eyepatch and a friendly smile, light brown skin, black uniform',
    'm18': 'a scruffy-haired adventurous young captain with a scarf, tanned skin, brown leather flight jacket',
    'm19': 'a cheerful round-faced captain with rosy cheeks and a curly brown beard, forest green uniform',
    'm20': 'a friendly furry alien captain who looks like a red panda, standing upright, wearing a blue captain\'s jacket',
    # ---- women ----
    'f01': 'a young captain with dark brown skin and a big puff of natural curly hair, confident smile, navy blue uniform with gold trim',
    'f02': 'a silver-haired older captain with a short bob and pale skin, kind eyes, deep red uniform with silver stars',
    'f03': 'a young East Asian captain with a high black ponytail and a headset microphone, bright teal uniform',
    'f04': 'a Māori captain with long dark wavy hair and a carved greenstone pendant, warm smile, black and silver uniform',
    'f05': 'a South Asian captain with a long dark braid over one shoulder, calm proud smile, white and gold uniform',
    'f06': 'a red-haired freckled young captain with flying goggles on her forehead, orange and grey pilot jacket',
    'f07': 'a captain with short cropped hair and dark skin, round glasses, clever smile, purple uniform',
    'f08': 'a Pacific Islander captain with a flower tucked behind her ear and long black hair, broad smile, ocean blue uniform',
    'f09': 'a Latina captain with curly brown hair tied up and laughing eyes, green uniform with a captain\'s badge',
    'f10': 'a grandmotherly captain with white hair in a bun and a captain\'s peaked cap, olive skin, crimson uniform',
    'f11': 'a young blonde captain with two short plaits and a cheeky wink, sky blue uniform',
    'f12': 'a captain wearing a soft blue headscarf, warm brown eyes and a gentle smile, sand coloured uniform',
    'f13': 'a friendly purple-skinned alien captain with large sparkly eyes and two small antennae, silver uniform',
    'f14': 'a captain who is a brave robot with a rounded shiny pink and white metal head, glowing friendly eyes, captain\'s sash',
    'f15': 'a young captain with long box braids, brown skin, an excited smile, yellow and black uniform',
    'f16': 'a Korean captain with a neat dark bob and a calm smile, deep navy uniform with a white collar',
    'f17': 'a captain with a glowing blue cybernetic ear piece and short silver-dyed hair, light brown skin, black uniform',
    'f18': 'an adventurous young captain with messy brown hair and a scarf, tanned skin, brown leather flight jacket',
    'f19': 'a cheerful round-faced captain with rosy cheeks and curly ginger hair, forest green uniform',
    'f20': 'a friendly furry alien captain who looks like an arctic fox, standing upright, wearing a blue captain\'s jacket',
}


def prompt(key: str) -> str:
    return STYLE + 'A portrait of ' + CAPTAINS[key] + '.' + TAIL


def graph(text: str, seed: int, key: str) -> dict:
    def sample(latent, denoise):
        return {'class_type': 'KSampler', 'inputs': {
            'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent, 'seed': seed, 'steps': 8, 'cfg': 1.0,
            'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': denoise}}
    return {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': 1024, 'height': 1024, 'batch_size': 1}},
        '8': sample(['7', 0], 1.0),
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '11': {'class_type': 'ImageScaleBy', 'inputs': {'image': ['9', 0], 'upscale_method': 'lanczos', 'scale_by': 1.5}},
        '12': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['3', 0]}},
        '13': sample(['12', 0], 0.4),
        '14': {'class_type': 'VAEDecode', 'inputs': {'samples': ['13', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': f'trader-captains/{key}'}},
    }


def call(path: str, body: dict | None = None, timeout: int = 60):
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def add_text(png: bytes, **entries: str) -> bytes:
    end = png.rfind(b'IEND') - 4
    chunks = b''
    for k, v in entries.items():
        data = k.encode('latin-1') + b'\0' + v.encode('latin-1', 'replace')
        chunks += struct.pack('>I', len(data)) + b'tEXt' + data + struct.pack('>I', zlib.crc32(b'tEXt' + data) & 0xFFFFFFFF)
    return png[:end] + chunks + png[end:]


def main(argv: list[str]) -> None:
    if '--list' in argv:
        for k in CAPTAINS:
            print(f'{k}: {prompt(k)}\n')
        return
    INBOX.mkdir(parents=True, exist_ok=True)
    todo = [k for k in CAPTAINS if not (INBOX / f'{k}.png').exists()]
    print(f'{len(todo)} captains to paint ({len(CAPTAINS) - len(todo)} already in the inbox).', flush=True)
    jobs = {}
    for k in todo:
        seed = zlib.crc32(f'captain-{k}'.encode())
        jobs[k] = (call('/prompt', {'prompt': graph(prompt(k), seed, k)})['prompt_id'], seed)
    print(f'All {len(jobs)} queued in ComfyUI. Waiting for them...', flush=True)
    while jobs:
        time.sleep(10)
        for k, (job, seed) in list(jobs.items()):
            try:
                done = call(f'/history/{job}').get(job)
            except OSError as e:
                print(f'  lost contact with ComfyUI ({e}); still waiting', flush=True)
                break
            if not done:
                continue
            del jobs[k]
            if done.get('status', {}).get('status_str') == 'error':
                print(f'  {k}: failed in ComfyUI', flush=True)
                continue
            img = next(i for o in done['outputs'].values() for i in o.get('images', []))
            q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
            with urllib.request.urlopen(f'{COMFY}/view?{q}', timeout=180) as r:
                png = r.read()
            (INBOX / f'{k}.png').write_bytes(add_text(png, captain_key=k, captain_prompt=prompt(k), captain_seed=str(seed)))
            print(f'  {k} saved ({len(CAPTAINS) - len(jobs) - (len(CAPTAINS) - len(todo))}/{len(todo)})', flush=True)
    print('Done.', flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
