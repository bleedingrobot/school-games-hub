#!/usr/bin/env python3
"""
Art style test for the Maths Monsters overworld (docs/monsters-art-test/). Runs on this computer only.
  python scripts/monsters-world-art.py render [map]            tile layers -> kauri-bush-tiles.png at 4x (64 px a tile)
  python scripts/monsters-world-art.py paint a|b|c [denoise]   ComfyUI img2img of the render in a style
  python scripts/monsters-world-art.py pupil a|b|c             a top-down pupil, four directions, cut out
  python scripts/monsters-world-art.py compare                 comparison images
Needs Pillow, numpy, rembg (~/.cache/rembg-venv/bin/python).
"""
import json, sys, time, urllib.parse, urllib.request, uuid
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'monsters-art-test'
WORLD = ROOT / 'src' / 'games' / 'monsters' / 'world' / 'assets'
SHEETS = [WORLD / 'kenney/tiny-town/tilemap_packed.png', WORLD / 'kenney/tiny-dungeon/tilemap_packed.png', WORLD / 'extra-tiles.png']
COMFY = 'http://100.97.96.115:8188'
SCALE, T = 4, 16
LAYERS = ['ground', 'walls', 'grass']

def render(name='kauri-bush', frame=0):
    m = json.load(open(ROOT / 'shared/monsters/maps' / f'{name}.json'))
    sets = m['tilesets']
    sheets = [Image.open(p).convert('RGBA') for p in SHEETS]
    img = Image.new('RGBA', (m['width'] * T, m['height'] * T), (0, 0, 0, 255))
    def tile(gid):
        gid &= 0x0FFFFFFF
        i = max(k for k, s in enumerate(sets) if gid >= s['firstgid'])
        s = sets[i]
        for t in s.get('tiles', []):  # water ripples: first frame
            if s['firstgid'] + t['id'] == gid and t.get('animation'):
                gid = s['firstgid'] + t['animation'][frame % len(t['animation'])]['tileid']
        loc = gid - s['firstgid']
        x, y = (loc % s['columns']) * T, (loc // s['columns']) * T
        return sheets[i].crop((x, y, x + T, y + T))
    for L in LAYERS:
        layer = next(l for l in m['layers'] if l['name'] == L)
        for n, gid in enumerate(layer['data']):
            if gid:
                img.alpha_composite(tile(gid), ((n % m['width']) * T, (n // m['width']) * T))
    img = img.convert('RGB').resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f'{name}-tiles.png')
    print(OUT / f'{name}-tiles.png', img.size)

STYLES = {
    'a': "Top-down overhead game map, bright flat storybook illustration, clean simple shapes, flat vivid colours, cheerful children's picture book, "
         "round bushy green trees seen from above, smooth tan dirt paths, blue water, darker tufty long grass patches, no text, no people, no characters, a grey slate-roofed stone house and a red-roofed cottage seen from above, small wooden signposts",
    'b': "Top-down overhead game map, soft watercolour painting, gentle washes of colour, soft edges, misty and calm like a painted storybook background, "
         "leafy trees seen from above, clear pale dirt paths, blue water, darker tufty long grass patches, no text, no people, no characters, a grey slate-roofed stone house and a red-roofed cottage seen from above, small wooden signposts",
    'c': "Top-down overhead game map, rich detailed painted fantasy game art, lush textured foliage, warm lighting, gentle shading, "
         "trees seen from above, clearly visible dirt paths, sparkling blue water, dark deep green tufty long grass patches, no text, no people, no characters, a grey slate-roofed stone house and a red-roofed cottage seen from above, small wooden signposts",
}

def call(path, body=None):
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def upload(p):
    b = uuid.uuid4().hex
    data = p.read_bytes()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{p.name}"\r\nContent-Type: image/png\r\n\r\n').encode() + data + \
           (f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n').encode()
    req = urllib.request.Request(COMFY + '/upload/image', data=body, headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())['name']

def run(graph, dest):
    job = call('/prompt', {'prompt': graph})['prompt_id']
    for _ in range(600):
        time.sleep(2)
        done = call(f'/history/{job}').get(job)
        if done:
            break
    else:
        sys.exit('ComfyUI took too long')
    img = next(i for o in done['outputs'].values() for i in o.get('images', []))
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
    dest.write_bytes(urllib.request.urlopen(f'{COMFY}/view?{q}', timeout=120).read())

def base(text, seed, denoise, latent):
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['9', 0], 'filename_prefix': 'monsters-world/img'}},
    }

def paint(style, denoise, name='kauri-bush'):
    src = OUT / f'{name}-tiles.png'
    w, h = Image.open(src).size
    ph, pw = (h // 16) * 16, (w // 16) * 16  # model size: multiples of 16, then scaled back exactly
    nm = upload(src)
    latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': nm}},
              's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': pw, 'height': ph, 'crop': 'disabled'}},
              '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
    dest = OUT / f'{name}-{style}-d{int(denoise*100)}.png'
    run(base(STYLES[style], 12345, denoise, latent), dest)
    im = Image.open(dest).convert('RGB')
    if im.size != (w, h):
        im = im.resize((w, h), Image.LANCZOS)
    im.save(dest)
    print(dest, im.size)


LOOKS = ROOT / 'src/games/monsters/art/painted/looks'
DIRS = {'down': 'facing toward the viewer, we see the face', 'up': 'facing away, we see the back of the head', 'left': 'facing left, seen from the side', 'right': 'facing right, seen from the side'}
def pupil(style, look='boy-01'):
    from rembg import new_session, remove
    sess = new_session('isnet-general-use')
    ref = Image.open(LOOKS / f'{look}.webp').convert('RGB')
    ref.thumbnail((768, 768))
    ref.save(OUT / '_ref.png')
    nm = upload(OUT / '_ref.png')
    st = {'a': 'bright flat storybook illustration', 'b': 'soft watercolour painting', 'c': 'rich painted fantasy game art'}[style]
    for d, words in DIRS.items():
        text = (f"Tiny full-body game character sprite of a cheerful 9 year old school pupil in the same clothes and hair as the reference, {words}, "
                f"standing, seen from a high top-down three-quarter overhead angle, {st}, plain flat white background, no text, no shadow")
        w, h = ref.size
        w, h = w // 16 * 16, h // 16 * 16
        latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': nm}},
                  's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': w, 'height': h, 'crop': 'disabled'}},
                  '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
        raw = OUT / f'_pupil-{style}-{d}.png'
        run(base(text, 777, 0.8, latent), raw)
        cut = remove(Image.open(raw).convert('RGB'), session=sess, alpha_matting=True)
        cut = cut.crop(cut.getbbox())
        cut.thumbnail((88, 88), Image.LANCZOS)
        out = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
        out.paste(cut, ((96 - cut.width) // 2, 96 - 4 - cut.height), cut)
        out.save(OUT / f'pupil-{style}-{d}.png')
        print(OUT / f'pupil-{style}-{d}.png')

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'render':
        render(*(sys.argv[2:3] or ['kauri-bush']))
    elif cmd == 'paint':
        paint(sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.55)
    elif cmd == 'pupil':
        pupil(sys.argv[2], *(sys.argv[3:4] or ['boy-01']))
