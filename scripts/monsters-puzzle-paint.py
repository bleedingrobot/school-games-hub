#!/usr/bin/env python3
"""
Paint the Maths Monsters puzzle makeover pictures (docs/MONSTERS-PUZZLE-ART-PLAN.md section 5). One try each.

  python scripts/monsters-puzzle-paint.py gen [out-folder] [name ...]   paint on ComfyUI into out-folder (default .puzzle-raw)
  python scripts/monsters-puzzle-paint.py list                           print the names

`gen` uses only the Python standard library, so it runs on the gaming PC with any Python 3. It never restarts ComfyUI or
changes its model, and skips pictures already painted (so a stopped run can be started again).
Turning the raw PNGs into game files (cut-outs, tiling, webp) is done by scripts/monsters-puzzle-pick.py.
Set COMFY to reach ComfyUI another way (default http://127.0.0.1:8188, the gaming PC itself).
"""
import json, os, sys, time, urllib.parse, urllib.request, uuid
from pathlib import Path

COMFY = os.environ.get('COMFY', 'http://127.0.0.1:8188')
STYLE = 'hand-painted, soft painterly brush strokes, bright cheerful colours, polished modern cosy top-down RPG game art, friendly for children'
SPR = ('hand-painted polished cosy RPG game sprite, bright friendly colours, soft shading, '
       'isolated on a plain flat pure white background, no ground, no shadow, no text')
TOP = 'seen from a high three-quarter top-down view, ' + SPR
FRONT = 'seen straight from the front, ' + SPR
TILE = 'seamless tileable top-down painted texture, {s}, ' + STYLE + ', flat even lighting, no objects, no border, no frame, no grid, no text'
PIC = '{s}, ' + STYLE + ', centred, the whole thing in view, no text, no letters, no numbers'
STONE = ('one single flat {s} grey stepping stone seen straight from above, smooth plain flat top surface with no marks and no numbers, '
         'a wet shiny rim, a little green seaweed at the waterline, ')

# name -> (kind, paint width, paint height, prompt). kind: sprite (cut out later), tile (made seamless later),
# pic (kept as painted), lit (repaints the lantern picture glowing).
ITEMS = {
 # P2 stepping stones
 'stone-round': ('sprite', 768, 768, STONE.format(s='round') + TOP),
 'stone-oval': ('sprite', 768, 768, STONE.format(s='oval') + TOP),
 'stone-flat': ('sprite', 768, 768, STONE.format(s='wide flat slab') + TOP),
 'stone-moss': ('sprite', 768, 768, STONE.format(s='round mossy, with soft green moss patches on the rim,') + TOP),
 'lily-1': ('sprite', 768, 768, 'one single big round flat green lily pad seen straight from above, a small notch, plain flat top, ' + TOP),
 'lily-2': ('sprite', 768, 768, 'one single big round flat green lily pad seen straight from above with one small pink flower at its edge, plain flat middle, ' + TOP),
 'coral-1': ('sprite', 768, 768, 'one single flat round pink coral rock seen straight from above, smooth flat top, ' + TOP),
 'coral-2': ('sprite', 768, 768, 'one single flat round orange and cream coral rock seen straight from above, smooth flat top, ' + TOP),
 'pool': ('tile', 1024, 1024, TILE.format(s='shallow clear turquoise rock-pool water over smooth pale sand, soft sunlight caustic light patterns, a few small round pebbles, uniform all over, no shoreline')),
 'lagoon': ('tile', 1024, 1024, TILE.format(s='bright clear tropical lagoon water, very light turquoise over white sand, soft caustic light patterns, a few tiny coral bits, uniform all over, no shoreline')),
 'bank': ('pic', 512, 1536, PIC.format(s='a tall narrow strip of golden sandy beach seen straight from above, wet darker sand along the left edge, a few small shells, plain sand in the middle, fills the whole picture')),
 'splash': ('sprite', 768, 768, 'one white water splash seen from above, a crown of splashing water droplets and a ring of foam, ' + TOP),
 # P3 lantern door
 'door-arch': ('pic', 1024, 768, PIC.format(s='a huge carved dark volcanic stone archway seen straight from the front, glowing orange cracks in the stone, an empty dark wooden beam across the top, a plain flat dark stone wall inside the arch')),
 'lantern': ('sprite', 768, 768, 'one single unlit old black iron lantern with glass panes and a ring handle, the glass is dark and empty, no flame, no fire, no light, no glow, unlit, cold and dull, ' + FRONT),
 'lantern-lit': ('lit', 768, 768, 'one single old black iron lantern with glass panes and a ring handle, blazing bright orange flame inside, intense warm orange light, strong glowing orange halo around the glass, ' + FRONT),
 'tag': ('sprite', 1024, 512, 'one blank rectangular warm honey-coloured wooden tag with a small rope hole at the top, rounded corners, nothing written on it, ' + FRONT),
 'smoke': ('sprite', 768, 768, 'one small soft round puff of grey smoke, ' + FRONT),
 # P4 ice slides
 'ice': ('tile', 1024, 1024, TILE.format(s='pale blue glassy ice surface with faint white cracks, soft reflections and frosty sparkles')),
 'ice-night': ('tile', 1024, 1024, TILE.format(s='dark teal glassy night ice reflecting soft green and purple aurora light, faint white cracks')),
 'snow': ('tile', 1024, 1024, TILE.format(s='soft deep fresh white snow with gentle blue shadows and lumps')),
 'rock-a': ('sprite', 768, 768, 'one single large round snowy boulder, grey rock with a thick cap of white snow, ' + TOP),
 'rock-b': ('sprite', 768, 768, 'one single tall pointed snowy boulder, grey rock with white snow on top, ' + TOP),
 'rock-c': ('sprite', 768, 768, 'one single wide flat snowy boulder, grey rock with a layer of white snow, ' + TOP),
 # P5 stone door and hot spring chest
 'glowworm': ('sprite', 512, 1024, 'one single tiny glowing blue-green glowworm light hanging on a long thin shiny silk thread with small dew drops, ' + FRONT),
 'cave-roof': ('tile', 1024, 1024, TILE.format(s='dark wet cave ceiling rock seen from below, deep blue-black stone, faint texture, uniform, no lights')),
 'lock-door': ('pic', 1024, 768, PIC.format(s='a carved grey stone door seen straight from the front, three empty round slots in a row in the middle, mossy edges, a cave around it')),
 'drum': ('sprite', 512, 1024, 'one upright smooth pale stone cylinder drum seen straight from the front, blank, nothing written on it, ' + FRONT),
 'sign': ('sprite', 1024, 512, 'one blank wide wooden signboard on a short post, nothing written on it, ' + FRONT),
 'chest-lock': ('sprite', 768, 768, 'one sturdy closed wooden treasure chest with brass bands and a brass three-dial number lock on the front, ' + TOP),
 # P6 wharf
 'wharf': ('tile', 1024, 1024, TILE.format(s='old weathered brown wooden wharf planks laid side by side, wood grain, dark gaps between planks, a few nail heads')),
 'wall': ('tile', 1024, 1024, TILE.format(s='deep blue harbour water, gentle slow ripples and soft lighter wave lines, empty open water, no objects')),
 'crate': ('sprite', 768, 768, 'one single closed wooden shipping crate, a solid cube with a flat closed plank lid on top, plank sides, metal corner brackets, rope handles, ' + TOP),
 'mark': ('sprite', 768, 768, 'one chalk-white painted circle with a big cross inside it, a cargo mark, seen straight from above, ' + SPR),
 'bollard': ('sprite', 768, 768, 'one single black iron wharf bollard post, ' + TOP),
 'rope': ('sprite', 768, 768, 'one single neat coil of thick brown rope, ' + TOP),
 'boat': ('sprite', 768, 768, 'one small red and white wooden rowing dinghy, ' + TOP),
 # P7 map, prize card
 'seed-pod': ('sprite', 768, 768, 'one single brown kauri tree seed cone pod, ' + FRONT),
 'puzzle-sign': ('sprite', 768, 768, 'one small wooden sign on a post with a big question mark shape carved into it, ' + FRONT),
 'bit-leaf': ('sprite', 768, 768, 'one single heart-shaped green kawakawa leaf, ' + FRONT),
 'bit-water': ('sprite', 768, 768, 'one single pretty pink and cream sea shell, ' + FRONT),
 'bit-fire': ('sprite', 768, 768, 'one single small glowing orange ember coal with tiny sparks, ' + FRONT),
 'bit-ice': ('sprite', 768, 768, 'one single small icy blue frost crystal, ' + FRONT),
 'bit-spark': ('sprite', 768, 768, 'one small pile of sparkling glowing yellow glow dust, ' + FRONT),
 'bit-stone': ('sprite', 768, 768, 'one single smooth round grey pebble, ' + FRONT),
}

def call(path, body=None):
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def upload(p):
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{p.name}"\r\nContent-Type: image/png\r\n\r\n').encode() + p.read_bytes() + \
           (f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n').encode()
    req = urllib.request.Request(COMFY + '/upload/image', data=body, headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())['name']

def run(graph, dest):
    job = call('/prompt', {'prompt': graph})['prompt_id']
    for _ in range(3600):  # waits up to 2 hours: other threads' jobs may be ahead in the queue
        time.sleep(2)
        done = call(f'/history/{job}').get(job)
        if done:
            break
    else:
        sys.exit('ComfyUI took too long')
    img = next(i for o in done['outputs'].values() for i in o.get('images', []))
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
    dest.write_bytes(urllib.request.urlopen(f'{COMFY}/view?{q}', timeout=120).read())

def graph(text, seed, denoise, latent):
    return {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        **latent,
        '8': {'class_type': 'KSampler', 'inputs': {'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': ['7', 0],
              'seed': seed, 'steps': 8, 'cfg': 1.0, 'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': denoise}},
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['9', 0], 'filename_prefix': 'monsters-puzzles/img'}},
    }

def gen(out, only):
    out.mkdir(parents=True, exist_ok=True)
    names = list(ITEMS)
    for i, n in enumerate(names):
        if only and n not in only: continue
        dest = out / f'{n}.png'
        if dest.exists(): continue
        kind, w, h, text = ITEMS[n]
        seed = 7100 + i
        if kind == 'lit':  # the same lantern, repainted glowing
            src = out / 'lantern.png'
            if not src.exists(): gen(out, ['lantern'])
            latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': upload(src)}},
                      's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': w, 'height': h, 'crop': 'disabled'}},
                      '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
            run(graph(text, seed, 0.62, latent), dest)
        else:
            run(graph(text, seed, 1.0, {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}}}), dest)
        print(f'{i + 1}/{len(names)} {dest}', flush=True)

if __name__ == '__main__':
    c = sys.argv[1] if len(sys.argv) > 1 else ''
    if c == 'gen': gen(Path(sys.argv[2] if len(sys.argv) > 2 else '.puzzle-raw'), sys.argv[3:])
    elif c == 'list': print('\n'.join(ITEMS))
    else: sys.exit(__doc__)
