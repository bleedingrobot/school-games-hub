#!/usr/bin/env python3
"""
Paints the rest of the Maths Monsters quests art (docs/MONSTERS-QUESTS-PLAN.md, Q.3 and Q.6) on James's gaming PC,
in one long unattended run, so it can work while nobody is watching. Runs on this computer only.

  python scripts/monsters-quests-art.py candidates [slots]   paint 2 tries of each slot into the inbox (skips tries already there)
  python scripts/monsters-quests-art.py all                  candidates, then (once the map parts job has finished) every
                                                             painted map, then any walkers still missing

The inbox is ~/dragon-art-inbox/maths-monsters-quests/<slot>-<try>.png, named as scripts/monsters-art.py expects
(monster-<id>[-shiny], person-<name>, scene-<map>), plus egg-<kind> and giant-<id> (map sprites). Nothing here is picked
or put in the game: a person looks at the tries first, then the chosen ones go through monsters-art.py.
Only positive words in prompts: this model draws whatever a prompt names, even after "no".
Use ~/.cache/rembg-venv/bin/python.
"""
import importlib.util, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = Path.home() / 'dragon-art-inbox/maths-monsters-quests'
PY = sys.executable
spec = importlib.util.spec_from_file_location('wa', ROOT / 'scripts/monsters-world-art.py')
wa = importlib.util.module_from_spec(spec); spec.loader.exec_module(wa)

MON = ('a cute but strong fantasy creature for a children\'s monster-collecting game, {d}, full body, three-quarter view, '
       'highly detailed painterly digital painting, rich colours, soft studio lighting, centred, on a plain flat pure white background')
SHINY = {'leaf': 'golden autumn orange and red', 'water': 'coral pink and pearl white', 'fire': 'bright blue flames and silver',
         'ice': 'lavender purple and silver', 'spark': 'teal and magenta', 'stone': 'shining gold and bronze'}
MONSTERS = {
  'kilokiwi-1': ('leaf', 'a small round kiwi bird monster with fluffy green feathers made of fern fronds, a long curved beak and bright curious eyes'),
  'kilokiwi-2': ('leaf', 'a big strong kiwi bird monster, fern-frond feathers, mossy armour plates on its back, powerful legs, a long curved beak'),
  'plustoise-1': ('water', 'a small friendly turtle monster with a smooth blue shell patterned with neat white cross shapes, water droplets'),
  'plustoise-2': ('water', 'a huge sea tortoise monster whose shell is a stacked tower of blue shell plates and coral, water spouting from the top'),
  'arraydillo-1': ('fire', 'a small armadillo monster whose armour is glowing orange and red tiles in neat rows and columns like a grid, little flames on its tail'),
  'arraydillo-2': ('fire', 'a big armadillo monster with armour of glowing ember tiles in perfect rows and columns, a blazing fiery tail, strong claws'),
  'shareseal-1': ('ice', 'a cute white and pale blue baby seal monster with icy whiskers and snowflake-shaped spots, sitting on a little ice floe'),
  'shareseal-2': ('ice', 'a sleek orca whale monster with icy blue and white markings split neatly in halves, frosty fins, rising up on its tail'),
  'quarterowl-1': ('spark', 'a small owl monster with electric yellow feathers, glowing eyes, its round face split into four coloured quarters, tiny sparks around it'),
  'quarterowl-2': ('spark', 'a large majestic owl monster with glowing yellow and violet feathers, a perfect glowing circle on its chest, wings crackling with lightning'),
  'tuatenth-1': ('stone', 'a small tuatara lizard monster from New Zealand with grey stone scales, a row of little spines down its back and a pebbly tail'),
  'tuatenth-2': ('stone', 'a big tuatara monster with craggy rock armour, rows of crystal spikes down its back, a strong stony tail'),
  'dozepebble-1': ('stone', 'a round sleepy boulder monster with droopy half-closed eyes, moss growing on top, little stubby legs, yawning'),
  'dozepebble-2': ('stone', 'a huge sleepy rock giant monster, a mountain of grey boulders with a drowsy face, warm steam puffing from its nose, moss and small plants growing on it'),
  'napsea-1': ('water', 'a small sleepy sea creature monster like a dozy round manatee, soft blue skin, half-closed eyes, bubbles floating up'),
  'napsea-2': ('water', 'a giant sleepy sea serpent monster, deep blue scales, coral growing on its back, half-closed dreamy eyes, waves curling around it'),
  'blinkberg-1': ('ice', 'a small iceberg monster with big blinking eyes, a chunky body of blue and white ice, frost sparkles'),
  'blinkberg-2': ('ice', 'a giant iceberg monster with a huge sleepy yawning mouth, snow piled on its head, long icicles, frosty breath'),
  'infinitail-1': ('fire', 'a legendary fox monster with a very long tail looping in a figure-eight shape, fur made of fire and crackling lightning, glowing eyes, majestic'),
  'primerald-1': ('leaf', 'a legendary stag monster with antlers of glowing emerald crystal, a body of grey stone and mossy leaves, vines twisting around its legs'),
  'equalizard-1': ('water', 'a legendary lizard monster that is half flowing water and half clear crystal ice, perfectly balanced, glowing softly'),
}
PERSON = ('a full-body photo of {d}, friendly smile, standing facing the camera, modestly dressed, soft daylight, '
          'centred, on a plain flat pure white background')
PEOPLE = {
  'tinker': 'a friendly older inventor woman with curly grey hair, round brass goggles on her forehead, a brown leather apron over a long-sleeved green shirt buttoned up to the collar, a tool belt, holding a small spanner',
  'geyser-gus': 'a cheerful strong man with a short red beard, a long-sleeved orange fleece jacket zipped up to the chin, hiking trousers and sturdy boots',
  'diver-ngaio': 'a smiling Maori woman diver in a long-sleeved navy blue full wetsuit zipped up to the chin, diving goggles pushed up on her head, holding a seashell',
  'skier-rewi': 'a smiling young Maori man skier in a thick red ski jacket zipped up to the chin, black ski trousers, a woolly beanie with ski goggles on it, holding ski poles',
}
SCENE = ('a wide empty landscape for the background of a children\'s fantasy monster battle, {d}, flat open ground across the lower third, '
         'beautiful painterly digital painting, bright cheerful colours, wide view')
SCENES = {
  'steam-valley': 'a hidden green valley with steaming hot springs, bubbling turquoise pools, white rocks, palm trees and drifting steam',
  'lagoon-isle': 'a small tropical island with a calm turquoise lagoon, white sand, palm trees and rock pools under a sunny sky',
  'aurora-hollow': 'a snowy hollow at night under bright green and violet aurora lights, ice arches, glittering snow and dark blue sky with stars',
}
EGG = ('one single large monster egg for a children\'s game, {d}, smooth oval shape, painterly digital painting, soft lighting, '
       'centred, on a plain flat pure white background')
EGGS = {
  'leafy': 'pale green with leaf and fern patterns and a little curl of vine', 'water': 'pale blue with wavy wave patterns and pearly bubbles',
  'warm': 'warm orange and red with glowing ember speckles', 'cold': 'icy white and pale blue with frost patterns and snowflake speckles',
  'glowing': 'deep violet with softly glowing yellow spots like glowworms', 'stony': 'grey speckled like granite with small crystal flecks',
}
GIANT = ('seen from a high three-quarter top-down view, a hand-painted polished cosy RPG game sprite of {d}, fast asleep curled up, eyes closed, '
         'bright friendly colours, soft shading, isolated on a plain flat pure white background')
GIANTS = {
  'snorumble': 'a huge round rock giant monster made of grey boulders with moss on top, warm steam puffing from its nose',
  'drowsea': 'a giant deep blue sea serpent monster with coral on its back, lying in a coil',
  'yawnberg': 'a giant iceberg monster of blue and white ice with snow on its head and icicles',
}

def slots():
    out = {}
    for sid, (t, d) in MONSTERS.items():
        out[f'monster-{sid}'] = (MON.format(d=d), 1024, 1024)
        out[f'monster-{sid}-shiny'] = (MON.format(d=d + f', in rare shiny colours of {SHINY[t]}'), 1024, 1024)
    for n, d in PEOPLE.items(): out[f'person-{n}'] = (PERSON.format(d=d), 832, 1216)
    for n, d in SCENES.items(): out[f'scene-{n}'] = (SCENE.format(d=d), 1600, 896)
    for n, d in EGGS.items(): out[f'egg-{n}'] = (EGG.format(d=d), 1024, 1024)
    for n, d in GIANTS.items(): out[f'giant-{n}'] = (GIANT.format(d=d), 1024, 1024)
    return out

def candidates(only=None):
    INBOX.mkdir(parents=True, exist_ok=True)
    for i, (slot, (text, w, h)) in enumerate(slots().items()):
        if only and slot not in only: continue
        for t in (1, 2):
            dest = INBOX / f'{slot}-{t}.png'
            if dest.exists(): continue
            seed = 4100 + i * 7 + t
            latent = {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}}}
            for attempt in range(3):
                try:
                    wa.run(wa.base(text, seed, 1.0, latent), dest)
                    print('painted', dest.name, flush=True)
                    break
                except Exception as e:  # the PC busy or asleep: wait and try again
                    print('retry', dest.name, e, flush=True)
                    time.sleep(60)

def parts_job_running():
    r = subprocess.run(['pgrep', '-f', 'monsters-map-paint.py parts'], capture_output=True, text=True)
    return bool(r.stdout.strip())

def everything():
    candidates()
    while parts_job_running():
        print('waiting for the map parts job', flush=True)
        time.sleep(120)
    subprocess.run([PY, str(ROOT / 'scripts/monsters-map-paint.py'), 'sheet'], cwd=ROOT)
    subprocess.run([PY, str(ROOT / 'scripts/monsters-map-paint.py'), 'map', 'all'], cwd=ROOT)
    for what in ('looks', 'people', 'props', 'sheets'):
        subprocess.run([PY, str(ROOT / 'scripts/monsters-walkers-art.py'), what], cwd=ROOT)
    print('ALL DONE', flush=True)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd == 'candidates': candidates(set(sys.argv[2:]) or None)
    elif cmd == 'all': everything()
    else: sys.exit(__doc__)
