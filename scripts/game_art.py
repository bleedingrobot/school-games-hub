#!/usr/bin/env python3
"""
One art script for every game. It reads a game's settings from docs/<game>-art/config.json (the picture list, the words
for each picture, sizes, and how each one is cut out and filed) and paints them in ComfyUI on James's gaming PC. Runs on a
computer that can reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site
build. No game words live in this file: they are all in the config. Lifted from scripts/weka-art.py (the newest junior
game's script); same graph, seeds and tidying.

  python3 scripts/game_art.py GAME paint OUT_DIR [names] [--tries 2] [--style b] [--force]  # OUT_DIR/<style>/<name>-<try>.png (--force repaints tries already there)
  python3 scripts/game_art.py GAME list                                            # every picture name
  ~/.cache/rembg-venv/bin/python scripts/game_art.py GAME tidy [--force]            # picks -> the game's art folders
  python3 scripts/game_art.py GAME paint|tidy|list --dry-run                        # check the config, print the plan,
                                                                                     # never contact the PC or write a file
GAME is a folder name under docs/ (docs/GAME-art/config.json), or a path to a config.json. A "/" in a picture name becomes
"_" in the file name.

Config (all paths are relative to the repo unless they start with ~):
  game            name used in messages
  filename_prefix ComfyUI output prefix, e.g. "<game>/img"
  comfy           optional ComfyUI address (default http://100.97.96.115:8188)
  style           the default style key
  styles          {key: words put in front of every picture's words}
  seed_by         optional: "name" (default) or "name+style" (the seed also depends on the style)
  graph           optional overrides: steps, cfg, shift, second_pass_scale, second_pass_denoise
  inbox           folder the tries are painted into (the style key is added: <inbox>/<style>/)
  picks           JSON file {picture name: chosen try number}
  art_dir         folder the game's cut-outs and scenes go in
  home_dir        folder for home page cards
  quality         optional {cut, scene, scene_small, card, card_small} WebP qualities
  tints           optional {tint name: {dark, mid, shine}}: colours (RGB) for a recoloured copy of a cut-out
  pictures        a list of {name, prompt, size [w, h], kind, folder, file, max, tints?}
    kind  "cut"   cut out of its white background, trimmed, shrunk to `max` px -> <art_dir>/<folder>/<file>.webp
          "scene" kept whole, 1600 px and an 800 px copy -> <art_dir>/<folder>/<file>.webp and <file>-800.webp
          "texture" a plain flat texture (a mat): a `region` [x0, y0, x1, y1] (fractions of the painting, default the middle half),
                  optionally `mirror`ed 2x2 so it tiles without a seam, or `blend`ed (cross-faded with a copy moved half a tile,
                  so the edges wrap with no mirror pattern; better for rock), shrunk to `max` px -> <art_dir>/<folder>/<file>.webp
          "card"  a home page card, 1600 px and 800 px -> <home_dir>/<file>.webp and <file>-small.webp
          "icon"  kept whole with its painted background (a trophy, an earned picture), shrunk to `max` px, and to `small` px
                  too if given -> <art_dir>/<folder>/<file>.webp and <file>-small.webp
    hollow true on a cut-out: it has a see-through middle (a picture ring), so the hole is cut out too, not filled in
    tints  {tint name: file name}: also write a recoloured copy of a cut-out to <art_dir>/<folder>/<file name>.webp
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_COMFY = 'http://100.97.96.115:8188'
KINDS = ('cut', 'scene', 'card', 'texture', 'icon')
QUALITY = {'cut': 82, 'scene': 72, 'scene_small': 70, 'card': 80, 'card_small': 78, 'icon': 86}
GRAPH = {'steps': 8, 'cfg': 1.0, 'shift': 3.0, 'second_pass_scale': 1.5, 'second_pass_denoise': 0.4}


# ---- The config ----

def load_config(arg: str) -> dict:
    path = Path(arg) if arg.endswith('.json') else ROOT / 'docs' / f'{arg}-art' / 'config.json'
    if not path.is_absolute():
        path = (Path.cwd() / path) if (Path.cwd() / path).exists() else ROOT / path
    if not path.exists():
        sys.exit(f'No config at {path}')
    config = json.loads(path.read_text())
    problems = check(config)
    if problems:
        sys.exit(f'{path}: {len(problems)} problem(s)\n  ' + '\n  '.join(problems))
    return config


def check(c: dict) -> list[str]:
    """Everything wrong with a config, in plain words (an empty list means it is fine)."""
    bad: list[str] = []
    for key in ('game', 'filename_prefix', 'style', 'styles', 'inbox', 'picks', 'art_dir', 'pictures'):
        if key not in c:
            bad.append(f'missing "{key}"')
    if bad:
        return bad
    if c['style'] not in c['styles']:
        bad.append(f'style "{c["style"]}" is not in styles')
    if c.get('seed_by', 'name') not in ('name', 'name+style'):
        bad.append('seed_by must be "name" or "name+style"')
    names: set[str] = set()
    files: set[str] = set()
    for i, p in enumerate(c['pictures']):
        label = p.get('name', f'#{i}')
        for key in ('name', 'prompt', 'size', 'kind'):
            if key not in p:
                bad.append(f'{label}: missing "{key}"')
        if 'name' not in p:
            continue
        if p['name'] in names:
            bad.append(f'{label}: name used twice')
        names.add(p['name'])
        if p.get('style', c['style']) not in c['styles']:
            bad.append(f'{label}: style "{p["style"]}" is not in styles')
        if not str(p.get('prompt', '')).strip():
            bad.append(f'{label}: empty prompt')
        size = p.get('size')
        if not (isinstance(size, list) and len(size) == 2 and all(isinstance(n, int) and n > 0 and n % 16 == 0 for n in size)):
            bad.append(f'{label}: size must be [width, height], whole numbers that are multiples of 16')
        kind = p.get('kind')
        if kind not in KINDS:
            bad.append(f'{label}: kind must be one of {", ".join(KINDS)}')
            continue
        if 'file' not in p or (kind != 'card' and 'folder' not in p):
            bad.append(f'{label}: needs "file"' + ('' if kind == 'card' else ' and "folder"'))
            continue
        if kind in ('cut', 'texture', 'icon') and not isinstance(p.get('max'), int):
            bad.append(f'{label}: a cut-out needs a whole-number "max" size')
        if kind == 'card' and 'home_dir' not in c:
            bad.append(f'{label}: a card needs "home_dir" in the config')
        for tint, tint_file in p.get('tints', {}).items():
            if kind != 'cut':
                bad.append(f'{label}: only a cut-out can have tints')
            if tint not in c.get('tints', {}):
                bad.append(f'{label}: tint "{tint}" is not in tints')
            spot = f'{p.get("folder")}/{tint_file}'
            if spot in files:
                bad.append(f'{label}: tint file {spot} is used by another picture')
            files.add(spot)
        spot = f'{"@home" if kind == "card" else p["folder"]}/{p["file"]}'
        if spot in files:
            bad.append(f'{label}: file {spot} is used by another picture')
        files.add(spot)
    for tint, colours in c.get('tints', {}).items():
        if sorted(colours) != ['dark', 'mid', 'shine'] or any(len(v) != 3 for v in colours.values()):
            bad.append(f'tint {tint}: needs dark, mid and shine, each [r, g, b]')
    return bad


def seed_for(c: dict, name: str, style: str, n: int) -> int:
    """Fixed seeds, so a try can be painted again exactly."""
    base = sum(map(ord, name + (style if c.get('seed_by') == 'name+style' else '')))
    return (base * 7919 + n * 104729) % 2**32


def full_prompt(c: dict, style: str, p: dict) -> str:
    # A picture can name its own style (for example a ring painted on plain white to be cut out).
    return c['styles'][p.get('style', style)] + p['prompt']


def resolve(c: dict, key: str) -> Path:
    path = Path(c[key]).expanduser()
    return path if path.is_absolute() else ROOT / path


# ---- Painting ----

def graph(c: dict, text: str, seed: int, width: int, height: int) -> dict:
    g = {**GRAPH, **c.get('graph', {})}
    base = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': g['shift']}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': width, 'height': height, 'batch_size': 1}},
    }
    sample = lambda latent, denoise: {'class_type': 'KSampler', 'inputs': {
        'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent, 'seed': seed, 'steps': g['steps'],
        'cfg': g['cfg'], 'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': denoise}}
    return {
        **base,
        '8': sample(['7', 0], 1.0),
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '11': {'class_type': 'ImageScaleBy', 'inputs': {'image': ['9', 0], 'upscale_method': 'lanczos', 'scale_by': g['second_pass_scale']}},
        '12': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['3', 0]}},
        '13': sample(['12', 0], g['second_pass_denoise']),
        '14': {'class_type': 'VAEDecode', 'inputs': {'samples': ['13', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': c['filename_prefix']}},
    }


def call(comfy: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(comfy + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def file_name(name: str, n: int) -> str:
    return f'{name.replace("/", "_")}-{n}.png'


def paint(c: dict, out: Path, names: list[str], style: str, tries: int, dry: bool, force: bool = False):
    by_name = {p['name']: p for p in c['pictures']}
    unknown = [n for n in names if n not in by_name]
    if unknown:
        sys.exit('Not in the config: ' + ', '.join(unknown))
    if style not in c['styles']:
        sys.exit(f'Unknown style "{style}" (the config has: {", ".join(c["styles"])})')
    out = out / style
    comfy = c.get('comfy', DEFAULT_COMFY)
    if dry:
        print(f'DRY RUN: would paint into {out} through {comfy} (not contacted), {tries} try(s) each, style "{style}"')
    else:
        out.mkdir(parents=True, exist_ok=True)
    count = 0
    for name in names:
        p = by_name[name]
        w, h = p['size']
        for n in range(1, tries + 1):
            dest = out / file_name(name, n)
            if dest.exists() and not force:
                if dry:
                    print(f'  skip (already there)  {dest.name}')
                continue
            seed = seed_for(c, name, style, n)
            if dry:
                count += 1
                print(f'  {dest.name}  {w}x{h}  seed {seed}\n    {full_prompt(c, style, p)}')
                continue
            job = call(comfy, '/prompt', {'prompt': graph(c, full_prompt(c, style, p), seed, w, h)})['prompt_id']
            for _ in range(300):
                time.sleep(2)
                done = call(comfy, f'/history/{job}').get(job)
                if done:
                    break
            else:
                sys.exit(f'{dest.name}: ComfyUI took too long')
            img = next(i for o in done['outputs'].values() for i in o.get('images', []))
            q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
            with urllib.request.urlopen(f'{comfy}/view?{q}', timeout=60) as r:
                dest.write_bytes(r.read())
            print(f'  {style}/{dest.name}', flush=True)
    if dry:
        print(f'DRY RUN: {count} painting(s) to make, {len(names)} picture(s) in the list')


# ---- Tidying: the chosen try of each picture -> the game's art folders ----

def destinations(c: dict, p: dict) -> list[Path]:
    """Every file tidy writes for a picture."""
    if p['kind'] == 'card':
        home = resolve(c, 'home_dir')
        return [home / f'{p["file"]}.webp', home / f'{p["file"]}-small.webp']
    folder = resolve(c, 'art_dir') / p['folder']
    if p['kind'] == 'scene':
        return [folder / f'{p["file"]}.webp', folder / f'{p["file"]}-800.webp']
    if p['kind'] == 'icon':
        return [folder / f'{p["file"]}.webp'] + ([folder / f'{p["file"]}-small.webp'] if p.get('small') else [])
    return [folder / f'{p["file"]}.webp'] + [folder / f'{f}.webp' for f in p.get('tints', {}).values()]


def tint(img, colours: dict):
    """A recoloured copy of a cut-out (for example bronze and silver from the gold one, so all share one shape)."""
    import numpy as np
    from PIL import Image
    px = np.asarray(img, dtype=np.float32)
    light = px[..., :3].mean(axis=2, keepdims=True) / 255
    dark, mid, shine = (np.array(colours[k], dtype=np.float32) for k in ('dark', 'mid', 'shine'))
    rgb = np.where(light < 0.6, dark + (mid - dark) * light / 0.6, mid + (shine - mid) * (light - 0.6) / 0.4)
    return Image.fromarray(np.dstack([rgb, px[..., 3:]]).clip(0, 255).round().astype(np.uint8), 'RGBA')


def tidy(c: dict, style: str, force: bool, dry: bool):
    picks_path = resolve(c, 'picks')
    picks = json.loads(picks_path.read_text()) if picks_path.exists() else {}
    by_name = {p['name']: p for p in c['pictures']}
    stray = [n for n in picks if n not in by_name]
    if stray:
        sys.exit(f'{picks_path.name} names pictures the config does not have: ' + ', '.join(stray))
    inbox = resolve(c, 'inbox') / style
    quality = {**QUALITY, **c.get('quality', {})}
    if dry:
        print(f'DRY RUN: would tidy {len(picks)} pick(s) from {picks_path.relative_to(ROOT) if picks_path.is_relative_to(ROOT) else picks_path} (inbox {inbox}):')
        for name, t in picks.items():
            p = by_name[name]
            outs = destinations(c, p)
            todo = force or not outs[0].exists()
            print(f'  {name}-{t}.png  {p["kind"]}  ->  ' + ', '.join(str(o.relative_to(ROOT)) if o.is_relative_to(ROOT) else str(o) for o in outs) + ('' if todo else '  (already there, skipped)'))
        return
    import numpy as np
    from PIL import Image
    session = None

    def save(img, out: Path, q: int):
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, 'WEBP', quality=q, method=6)
        print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)

    def fit(img, size: int):
        img = img.copy()
        img.thumbnail((size, size), Image.LANCZOS)
        return img

    def trim(img, pad=4):
        a = np.asarray(img)[..., 3] > 40
        ys, xs = np.where(a)
        return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))

    def fill_holes(cut, source):
        # rembg can take a white tummy for background; anything walled in by the figure stays solid, in its painted colours.
        from scipy.ndimage import binary_fill_holes
        px = np.asarray(cut).copy()
        hole = binary_fill_holes(px[..., 3] > 128) & (px[..., 3] <= 128)
        px[hole, :3] = np.asarray(source)[hole]
        px[hole, 3] = 255
        return Image.fromarray(px, 'RGBA')

    def punch_middle(cut, source):
        # A ring: everything joined to the very middle that is the background's colour becomes see-through.
        from scipy.ndimage import label
        rgb = np.asarray(source).astype(np.int16)
        cy, cx = rgb.shape[0] // 2, rgb.shape[1] // 2
        same = np.abs(rgb - rgb[cy, cx]).sum(axis=2) < 60
        areas, _ = label(same)
        px = np.asarray(cut).copy()
        px[areas == areas[cy, cx], 3] = 0
        return Image.fromarray(px, 'RGBA')

    def blend_tile(part):
        # Seamless without mirroring: the painting's own middle forms the tile's edges (a copy moved half a tile wraps
        # cleanly), faded into the untouched painting towards the centre.
        a = np.asarray(part).astype(np.float32)
        h, w = a.shape[:2]
        moved = np.roll(a, (h // 2, w // 2), axis=(0, 1))
        wy = 1 - np.abs(np.linspace(-1, 1, h))
        wx = 1 - np.abs(np.linspace(-1, 1, w))
        k = np.clip(np.minimum.outer(wy, wx) * 2.5, 0, 1)[..., None]
        return Image.fromarray((a * k + moved * (1 - k)).round().astype(np.uint8), 'RGB')

    for name, t in picks.items():
        p = by_name[name]
        outs = destinations(c, p)
        if outs[0].exists() and not force:
            continue
        img = Image.open(inbox / file_name(name, t))
        if p['kind'] == 'card':
            img = img.convert('RGB')
            save(fit(img, 1600), outs[0], quality['card'])
            save(fit(img, 800), outs[1], quality['card_small'])
        elif p['kind'] == 'texture':
            img = img.convert('RGB')
            w, h = img.size
            x0, y0, x1, y1 = p.get('region', [0.25, 0.25, 0.75, 0.75])
            part = img.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))
            tile = part
            if p.get('blend'):
                tile = blend_tile(part)
            elif p.get('mirror'):
                flip = part.transpose(Image.FLIP_LEFT_RIGHT)
                tile = Image.new('RGB', (part.width * 2, part.height * 2))
                tile.paste(part, (0, 0)); tile.paste(flip, (part.width, 0))
                tile.paste(part.transpose(Image.FLIP_TOP_BOTTOM), (0, part.height)); tile.paste(flip.transpose(Image.FLIP_TOP_BOTTOM), (part.width, part.height))
            save(fit(tile, p['max']), outs[0], quality['cut'])
        elif p['kind'] == 'scene':
            img = img.convert('RGB')
            save(fit(img, 1600), outs[0], quality['scene'])
            save(fit(img, 800), outs[1], quality['scene_small'])
        elif p['kind'] == 'icon':
            img = img.convert('RGB')
            save(fit(img, p['max']), outs[0], quality['icon'])
            if p.get('small'):
                save(fit(img, p['small']), outs[1], quality['icon'])
        else:
            if session is None:
                from rembg import new_session
                session = new_session('isnet-general-use')
            from rembg import remove
            cut = remove(img.convert('RGB'), session=session, alpha_matting=True)
            cut = trim(punch_middle(cut, img.convert('RGB')) if p.get('hollow') else fill_holes(cut, img.convert('RGB')))
            save(fit(cut, p['max']), outs[0], quality['cut'])
            for (tint_name, _), out in zip(p.get('tints', {}).items(), outs[1:]):
                save(fit(tint(cut, c['tints'][tint_name]), p['max']), out, quality['cut'])


def main(args: list[str]):
    dry = '--dry-run' in args
    args = [a for a in args if a != '--dry-run']
    if len(args) < 2 or args[1] not in ('paint', 'tidy', 'list'):
        sys.exit(__doc__)
    c = load_config(args[0])
    command, rest = args[1], args[2:]
    opts = {'--tries': '2', '--style': c['style']}
    for flag in opts:
        if flag in rest:
            i = rest.index(flag)
            opts[flag] = rest[i + 1]
            del rest[i:i + 2]
    if command == 'list':
        print('\n'.join(p['name'] for p in c['pictures']))
    elif command == 'tidy':
        tidy(c, opts['--style'], '--force' in rest, dry)
    else:
        if not rest:
            sys.exit('Where do the tries go? e.g. game_art.py GAME paint OUT_DIR [names]')
        force = '--force' in rest
        rest = [a for a in rest if a != '--force']
        paint(c, Path(rest[0]).expanduser(), rest[1:] or [p['name'] for p in c['pictures']], opts['--style'], int(opts['--tries']), dry, force)
    if dry and command == 'list':
        print(f'DRY RUN: config fine, {len(c["pictures"])} pictures', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1:])
