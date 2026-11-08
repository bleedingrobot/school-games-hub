"""Builds page/data.json for the second review's fix plan page from recs-*.json and the plan files.

Run from the repo root: python3 -I docs/reviews/maths-review-2/page/build_data.py
"""
import json
import re
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
REPO = ROOT.parent.parent.parent

PAGE_URL = 'https://claude.ai/artifact/XQDGyC5rytsfNV2dAUi8Rd'
COMPARE_URL = 'https://claude.ai/artifact/KyXiMPb56SjiRfaAVwNDGS'

# Newer games first, then by how much each fix helps children learn; a card moves earlier only when another waits for it.
ORDER = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16',
         'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31',
         'S32', 'S33', 'S34', 'S35', 'S36']

recs_by_id = {}
for p in sorted(ROOT.glob('recs-*.json')):
    for r in json.loads(p.read_text()):
        recs_by_id[r['id']] = r


def prompts_of(plan):
    """The ```text blocks in a plan file, each with the nearest heading above it as its label."""
    parts, label, buf, inside = [], '', [], False
    for ln in plan.read_text().splitlines():
        if not inside and ln.startswith('```text'):
            inside, buf = True, []
        elif inside and ln.startswith('```'):
            inside = False
            parts.append({'label': label, 'text': '\n'.join(buf).strip()})
        elif inside:
            buf.append(ln)
        elif ln.startswith('#'):
            label = ln.lstrip('#').strip()
    for x in parts:
        x['label'] = re.sub(r'^(Part \d+:\s*|Prompt \d+:\s*|\d+\.\s*)', '', x['label']).strip() or 'Prompt'
    return parts


recs, problems = [], []
for i in ORDER:
    r = recs_by_id.get(i)
    if not r:
        problems.append(f'{i}: no JSON')
        continue
    r['group'] = 'newer' if int(i[1:]) <= 20 else 'older'
    pf = REPO / r['plan']
    if not pf.exists():
        problems.append(f'{i}: plan file missing {r["plan"]}')
        continue
    parts = prompts_of(pf)
    if not parts:
        problems.append(f'{i}: no ```text prompt')
    elif len(parts) == 1:
        r['prompt'] = parts[0]['text']
    else:
        r['prompts'] = parts
    for w in r.get('waits') or []:
        if w not in ORDER or ORDER.index(w) > ORDER.index(i):
            problems.append(f'{i}: waits for {w}, which is not earlier')
    recs.append(r)

CRIT = ['Maths', 'Clarity', 'Support', 'Fading', 'Progression', 'Feedback', 'Recording', 'Engagement']
G = [
    ("Pigeon's Number Line", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Parrot's See-saw", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Lizard's Bundles", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Swamp Hen's Reed Rows", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Robin's Berry Basket", None, [2, 3, 3, 3, 3, 3, 3, 3]),
    ("Kingfisher's Dairy", None, None),
    ("Weka's Stepping Stones", 24, [3, 3, 3, 3, 3, 3, 3, 3]),
    ('Quick looks', 23, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Tūī's Ten Tree", 22, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Pipi's Hidden Shells", 21, [3, 3, 3, 3, 3, 3, 3, 3]),
    ('Penguin Pairs (Kororā)', 20, [3, 3, 3, 3, 3, 3, 3, 3]),
    ("Kiwi's Beanstalk", 19, [3, 3, 3, 3, 2, 3, 3, 3]),
    ("Hop's Glow-worm Pond", 19, [3, 3, 3, 3, 3, 3, 3, 3]),
]
games = [{'name': n, 'first': f, 'scores': s} for n, f, s in G]

data = dict(
    lede=('The second review (8 November 2026) found the fixes made the older games much better: they went from 148 to 167 '
          'points, and six of the seven now reach the bar of a 3 on every line; Beanstalk (Progression) is still under it. '
          'Of the newer games, Robin (Maths) is under the bar and Kingfisher is not built yet. This page has one card per fix. The six newer games come first, then the older ones, each '
          'in order of how much the fix helps children learn.'),
    findings=[
        dict(title="Robin's answer is nearly always the third card",
             text='On card goes the right answer sits in the third place about 95 times in 100, so a child never has to count. Cards S1 and S2.'),
        dict(title='"Now you try" can be copied',
             text='After a mistake, the try-again go shows the same question, so children copy the answer they were just shown. In Robin and Parrot the right card is also marked. Cards S16 and S32.'),
        dict(title='No demo for new kinds, and teachers miss the newer games',
             text='No game shows a short demo the first time a new kind of go appears, and the five newer games are not in the teacher grid or Today alerts. Card S11 (the kit remembers seen kinds) comes first, then S12 and S31 for demos and S17 for teachers.'),
    ],
    criteria=CRIT, games=games, recs=recs,
    reportPath='docs/reviews/fundamental-maths-review-2.md',
    pageUrl=PAGE_URL, compareUrl=COMPARE_URL,
)
(HERE / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
print('recs', len(recs), 'of', len(ORDER))
for p in problems:
    print('PROBLEM', p)
