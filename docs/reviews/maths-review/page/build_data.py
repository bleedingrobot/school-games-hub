"""Builds page/data.json for the review page from the review files. Run: python3 -I build_data.py <maths-review folder>"""
import json, re, sys, pathlib

root = pathlib.Path(sys.argv[1]).resolve()
recs_by_id = {}
for name in ['data-quick.json', 'data-fixes.json', 'data-new.json']:
    p = root / name
    if p.exists():
        for r in json.loads(p.read_text()):
            recs_by_id[r['id']] = r
ORDER = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'N1', 'N2', 'R8', 'N3', 'N4', 'R9', 'N5', 'N6']
recs = [recs_by_id[i] for i in ORDER if i in recs_by_id]
repo = root.parent.parent.parent
for r in recs:
    pf = repo / r['plan']
    if not r.get('prompt') or not pf.exists():
        continue
    parts, label, buf, inside = [], '', [], False
    for ln in pf.read_text().splitlines():
        if not inside and ln.startswith('```text'):
            inside, buf = True, []
        elif inside and ln.startswith('```'):
            inside = False
            parts.append({'label': label, 'text': '\n'.join(buf).strip()})
        elif inside:
            buf.append(ln)
        elif ln.startswith('#') or (ln.startswith('**') and ln.rstrip().endswith('**')):
            label = ln.lstrip('#').strip().strip('*').strip()
    if len(parts) > 1:
        for x in parts:
            x['label'] = re.sub(r'^Prompt \d+:\s*', '', x['label']) or 'Prompt'
        r['prompts'] = parts
missing = [i for i in ORDER if i not in recs_by_id]

# Coverage matrix from coverage.md
COLS = {'BS': "Kiwi's Beanstalk", 'HO': 'Hop', 'PP': 'Penguin Pairs', 'PI': 'Pipi', 'TU': 'Tūī', 'WE': 'Weka',
        'QL': 'Quick looks', 'BM': 'Bond Match', 'FQ': 'Focus questions', 'MO': 'Maths Monsters', 'DM': 'Dragon Maths',
        'CQ': 'Clan Quest', 'OT': 'Other games'}
lines = (root / 'coverage.md').read_text().splitlines()
header = None
rows = []
for ln in lines:
    if not ln.startswith('|'):
        if header and rows:
            break
        continue
    cells = [c.strip() for c in ln.strip().strip('|').split('|')]
    if cells[0] == 'Skill' and len(cells) > 10:
        header = cells[1:]
        continue
    if header and len(cells) == len(header) + 1 and not set(cells[0]) <= set('-: '):
        marks = []
        for c in cells[1:]:
            c0 = c[:1].upper()
            marks.append('C' if c0 == 'C' else 'P' if c0 == 'P' else 'N')
        if cells[0].startswith('**'):
            continue
        rows.append((cells[0], marks))
GROUP_START = {'Repeating patterns': 'Algebra', 'Comparing length': 'Measurement', 'Naming, sorting': 'Geometry',
               'Sorting and classifying': 'Statistics'}
GAPS = ['Counting sequence', 'Comparing and ordering', 'Equals as', 'Missing numbers', 'Place value',
        'Equal groups', 'Money']
groups = [{'name': 'Number', 'rows': []}]
for skill, marks in rows:
    for k, g in GROUP_START.items():
        if skill.startswith(k):
            groups.append({'name': g, 'rows': []})
    groups[-1]['rows'].append({'skill': skill, 'marks': marks, 'gap': any(skill.startswith(x) for x in GAPS)})

CRIT = ['Maths fidelity', 'Clarity', 'Support', 'Fading', 'Progression', 'Feedback', 'Progress recording', 'Engagement']
games = [
    dict(name="Weka's Stepping Stones", idea='Make ten to add (bridging ten)', scores=[3, 3, 4, 3, 3, 2, 3, 3],
         works='The strongest of the set. Pebbles, a number line and a hint ladder that steps in after mistakes, and help that eases off as the child does well.',
         missing='Wrong choices are only one or two away from the answer, so tapping everything still wins. The pebble step stops at ten by itself, so the child does not have to. Level 1 repeats "9 + something" a lot.',
         fix='Mistakes that teach (R5): wrong choices built from real errors like stopping at the rock, and the child decides where ten is.'),
    dict(name='Quick looks', idea='Subitising: seeing how many without counting', scores=[3, 3, 3, 3, 3, 3, 2, 3],
         works='Well researched: stages in a sensible order, help comes and goes with the child, and wrong answers show the groups.',
         missing='Teachers can see nothing, although every answer is saved. "Keep the picture" practice counts towards passing, so a child can pass by counting. Reaction time is not saved.',
         fix='Quick looks fixes (R3), then put it in the teacher view (R7).'),
    dict(name="Tūī's Ten Tree", idea='Teen numbers as ten and some more', scores=[3, 3, 4, 2, 2, 2, 3, 3],
         works='Excellent models: ten-frames and a kete, with help that adapts to the child.',
         missing='A bug: help never fades for a strong child until step 5, because a new step adds the help straight back. Only nine facts all term, and 14 and 41 mix-ups are never named.',
         fix='Fix the fading bug (R1), a quick win.'),
    dict(name="Pipi's Hidden Shells", idea='Hidden amounts: part-whole', scores=[3, 3, 3, 2, 3, 2, 2, 3],
         works='The maths is the game: you really have to work out how many are hiding. A sensible order from small to bigger wholes.',
         missing='Help fades by the calendar and never comes back. A wrong tap only gets "Try again!", and tapping all four shells always wins. No "say it again" button.',
         fix='Help that follows the child (R6) and mistakes that teach (R5).'),
    dict(name='Penguin Pairs', idea='Doubles and halves', scores=[2, 3, 3, 2, 2, 2, 3, 3],
         works='Clear and friendly, with pictures that help early on, and the teacher can see each child\'s 3 hardest facts.',
         missing='On bronze days the game shares the halves out itself, so the answer can be read off. "Fair or not?" is a 50/50 guess. Only 4 short levels, ending at halves to 20.',
         fix='Mistakes that teach (R5), then a real pile for "Fair or not?" and a longer ladder (R8, R9).'),
    dict(name="Kiwi's Beanstalk", idea='Bonds to 10, 100 and 1000', scores=[2, 3, 3, 2, 2, 2, 2, 3],
         works='A clear goal and a lovely climb. Bonds to 100 and 1000 grow from bonds to 10.',
         missing='Random tapping can finish a day (one test day had 26 wrong taps and 8 right). The target number is only spoken, never shown. The jump from 3 + 7 to 70 + 30 has no bridge.',
         fix='Show the target and add a bridge (R4), then mistakes that teach (R5).'),
    dict(name="Hop's Glow-worm Pond", idea='Skip counting in 10s, 5s and 2s', scores=[2, 3, 3, 2, 2, 2, 2, 3],
         works='A clear, calm path, with "+10" labels as a model at first.',
         missing='Wrong choices are easy to rule out (in tens, only one ends in 0). The step-up clock starts while the voice is still talking, so careful children can get stuck on tens. Counting back comes late.',
         fix='Fair step-up for careful children (R2), then better wrong choices (R5).'),
]

ideas = [
    dict(id='N1', gap='Comparing, ordering and the number line', title='Number line game',
         text='Place numbers on a line and find one more, one less, and where 37 goes. This is the base for place value, rounding and mental strategies.'),
    dict(id='N2', gap='Equals as balance, and missing numbers', title='Balance scales',
         text='Make both sides weigh the same: 8 = ? + 5. It fixes the "equals means the answer comes next" mistake that blocks algebra later.'),
    dict(id='N3', gap='Place value to 100 and beyond', title='Bundle into tens',
         text='Bundle sticks or shells into tens and hundreds to build and read numbers. It carries on from Tūī, which stops at 20.'),
    dict(id='N4', gap='Equal groups and arrays', title='Rows and groups',
         text='Build equal rows and groups to show what times means. The hub asks times tables more than anything else, but only as a quiz.'),
    dict(id='N5', gap='Counting out a set', title='Give exactly N',
         text='Count out exactly the number asked for: one-to-one counting and "the last number says how many". This is the very first skill for new entrants.'),
    dict(id='N6', gap='Money: NZ coins and change', title='Dairy shop',
         text='Pay with NZ coins, make totals and give change. Idea only so far.'),
]
for d in ideas:
    r = recs_by_id.get(d['id'])
    if r:
        d['title'] = r.get('title', d['title'])

data = dict(
    lede='Six Foundational games and Quick looks were played, read line by line, scored against research on how young children learn maths and how good learning games work, and checked against live pupil data. They are clear, friendly and use the right pictures. Four things hold them back, and all of them can be fixed.',
    findings=[
        dict(title='Mistakes teach nothing', text='In every game a wrong tap gets a wobble and "Try again!". Wrong taps are free, so tapping every choice always wins, and the wrong choices are easy to rule out.'),
        dict(title='Help follows the calendar', text='In four games, pictures and labels fade by the number of days played, not by how the child is doing, and they never come back for a child who is struggling.'),
        dict(title='Careful children can get stuck', text='A fact only moves up if it is answered within 5 seconds. Slow, accurate 5-year-olds can stay on the same step, and in Hop the clock starts while the voice is still talking.'),
        dict(title="Teachers can't see who is stuck", text='Every answer is saved, but no teacher page shows who is stuck on what, and Quick looks has no teacher view at all.'),
        dict(title='Big gaps beyond number basics', text='No game yet teaches comparing numbers, equals as balance, place value past 20, equal groups, counting out a set, money, shape, measuring or graphs.'),
    ],
    criteria=CRIT, games=games, recs=recs, ideas=ideas,
    coverage=dict(columns=[COLS.get(c, c) for c in header], groups=groups),
    live=dict(
        note='Read-only numbers from the live database on 7 November 2026. The games are 1 to 6 days old, so the numbers are small. Accuracy is at or above the 75 to 90% sweet spot, so the games are not too hard. If anything they are too easy, or answers are found by ruling choices out.',
        stats=[
            dict(big='84%', label='right on bonds to 10 (48 pupils, all games sharing them)'),
            dict(big='93–95%', label='right on doubles, "ten and" facts and counting in 10s'),
            dict(big='81%', label='right in Quick looks (21 pupils, 378 answers)'),
            dict(big='3.2', label='wrong taps per Beanstalk round. 14% of rounds had 10 or more, a sign of guessing'),
            dict(big='15 · 10 · 10', label='pupils so far on Beanstalk, Hop and Penguin Pairs'),
        ]),
    reportPath='docs/reviews/fundamental-maths-review.md',
)
out = pathlib.Path(__file__).with_name('data.json')
out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
print('recs', len(recs), 'missing', missing, 'coverage rows', len(rows), 'cols', len(header))
