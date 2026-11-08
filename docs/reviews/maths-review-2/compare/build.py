"""Builds compare/data.json for the comparison page from the scores and the two issue files.

Run from the repo root: python3 -I docs/reviews/maths-review-2/compare/build.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

CRIT = ['Maths', 'Clarity', 'Support', 'Fading', 'Progression', 'Feedback', 'Recording', 'Engagement']

# (key used in the issue files, display name, first-review scores or None, second-review scores)
GAMES = [
    ('pigeon', "Pigeon's Number Line", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ('parrot', "Parrot's See-saw", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ('lizard', "Lizard's Bundles", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ('swamphen', "Swamp Hen's Reed Rows", None, [3, 3, 3, 3, 3, 3, 3, 3]),
    ('robin', "Robin's Berry Basket", None, [2, 3, 3, 3, 3, 3, 3, 3]),
    ('kingfisher', "Kingfisher's Dairy", None, None),
    ('Weka', "Weka's Stepping Stones", [3, 3, 4, 3, 3, 2, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3]),
    ('Quick looks', 'Quick looks', [3, 3, 3, 3, 3, 3, 2, 3], [3, 3, 3, 3, 3, 3, 3, 3]),
    ('Tūī', "Tūī's Ten Tree", [3, 3, 4, 2, 2, 2, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3]),
    ('pipi', "Pipi's Hidden Shells", [3, 3, 3, 2, 3, 2, 2, 3], [3, 3, 3, 3, 3, 3, 3, 3]),
    ('korora', 'Penguin Pairs (Kororā)', [2, 3, 3, 2, 2, 2, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3]),
    ('beanstalk', "Kiwi's Beanstalk", [2, 3, 3, 2, 2, 2, 2, 3], [3, 3, 3, 3, 2, 3, 3, 3]),
    ('hop', "Hop's Glow-worm Pond", [2, 3, 3, 2, 2, 2, 2, 3], [3, 3, 3, 3, 3, 3, 3, 3]),
]

# Why each line moved: real change, stricter reading, or mixed (partly a kinder reading of "one or two loopholes").
MOVES = {
    ('Weka', 'Support'): ('stricter', 'No code change. This review wanted a demo for each new kind of go.'),
    ('Weka', 'Feedback'): ('real', 'Why-lines and look-together (R5).'),
    ('Tūī', 'Support'): ('stricter', 'No code change. Same stricter test as Weka.'),
    ('Tūī', 'Fading'): ('real', 'The fading bug is fixed (R1). Level 4 is still a floor on steps 2 to 4.'),
    ('Tūī', 'Progression'): ('real', 'Take-away and a longer ladder (R8, R9).'),
    ('Tūī', 'Feedback'): ('real', 'Why-lines and look-together (R5).'),
    ('Quick looks', 'Recording'): ('real', 'Every answer saved; teacher sees stage (R3, R7).'),
    ('pipi', 'Fading'): ('real', 'Help per fact that comes back after weak goes (R6).'),
    ('pipi', 'Feedback'): ('real', 'Why-lines and look-together for every wrong shell (R5).'),
    ('pipi', 'Recording'): ('mixed', 'Grid and alerts are new, but per-fact rows already existed.'),
    ('korora', 'Maths'): ('mixed', 'Times-itself wrong answers gone and a real pile, but tap-all now read as one loophole.'),
    ('korora', 'Fading'): ('real', 'Help per fact (R6).'),
    ('korora', 'Progression'): ('mixed', 'Level 5 added, but the top is still short.'),
    ('korora', 'Feedback'): ('real', 'Why-lines, look-together and a pair-off hint (R5, R9).'),
    ('beanstalk', 'Maths'): ('real', 'No repeated numbers, target on screen, bridge to 100 (R4).'),
    ('beanstalk', 'Fading'): ('real', 'Dots per child that fade and come back.'),
    ('beanstalk', 'Feedback'): ('real', 'Why-line, frame and look-together replace the wobble (R5).'),
    ('beanstalk', 'Recording'): ('mixed', 'In the grid now, but per-fact rows existed and 100 and 1000 still share one key.'),
    ('hop', 'Maths'): ('mixed', 'The endings tell is gone, and tap-all is now read as one loophole.'),
    ('hop', 'Fading'): ('real', 'Help per hop that comes back (R6).'),
    ('hop', 'Progression'): ('real', 'Counting back, steps of 3 and 4, and to 200 (R8).'),
    ('hop', 'Feedback'): ('real', 'Why-lines and look-together (R5).'),
    ('hop', 'Recording'): ('mixed', 'Grid and alerts are new; per-fact rows existed.'),
}

NOTES = {
    'pigeon': 'Honest placing with six help levels. Many numerals printed at full help; near goes are a coin toss; the reason is text and an emoji.',
    'parrot': 'Stone goes model equality well. Card goes leave a 50% tell; the see-saw stays flat on false sums.',
    'lizard': 'The model is right, but tying ten sticks is only required on the first go, and a wrong attempt is wiped. The weakest 24.',
    'swamphen': 'Counting rows is honest. Share and turn are watched, not done. Played by script only.',
    'robin': 'Give goes are good. On card goes the answer is nearly always the third card, so counting is never needed. Under the bar (Maths 2).',
    'kingfisher': 'Not built yet, so not scored. Card S20 reviews it with the same method once it is live.',
    'Weka': 'Still the steadiest. Support fell only because this review asked for more.',
    'Quick looks': 'Every answer saved now. A wrong answer still shows the answer at once with no second try; voice off by default.',
    'Tūī': 'Fading fixed and take-away added. Full ten-frames still last about 8 days for a child who gets it all right.',
    'pipi': 'Help per fact and why-lines are big gains. No "Hear it again"; replays move the level.',
    'korora': 'Biggest real gain on Maths and Feedback. New halves still share themselves; level 5 unknown to the teacher view.',
    'beanstalk': 'Much clearer, but the sum still moves by the calendar. The only older game under the bar (Progression 2).',
    'hop': 'Largest rise. Still no "Hear it again", replays move the step, and the teacher view knows only steps 10, 5 and 2.',
}

NAME = {g[0]: g[1] for g in GAMES}
NAME['All'] = 'All games'
FIX_NAMES = {
    'R1': 'R1 Tūī fading', 'R2': 'R2 Fair step-up', 'R3': 'R3 Quick looks fixes', 'R4': 'R4 Beanstalk target and bridge',
    'R5': 'R5 Mistakes that teach', 'R6': 'R6 Help follows the child', 'R7': 'R7 Teacher view',
    'R8': 'R8 Longer ladders', 'R9': 'R9 Game depth',
}


def main():
    a = json.loads((ROOT / 'issues-a.json').read_text())
    b = json.loads((ROOT / 'issues-b.json').read_text())
    games = []
    for key, name, first, now in GAMES:
        moves = []
        if first and now:
            for i, c in enumerate(CRIT):
                if first[i] != now[i]:
                    kind, why = MOVES[(key, c)]
                    moves.append({'crit': c, 'from': first[i], 'to': now[i], 'kind': kind, 'why': why})
        games.append({'key': key, 'name': name, 'first': first, 'now': now, 'note': NOTES[key], 'moves': moves,
                      'newer': first is None})
    issues = [{**i, 'game': NAME[i['game']]} for i in a['issues'] + b['issues']]
    new = [{**n, 'game': NAME[n['game']], 'fixName': FIX_NAMES.get(n.get('fix') or '', '')} for n in a['new'] + b['new']]
    data = {'criteria': CRIT, 'games': games, 'issues': issues, 'new': new,
            'reportPath': 'docs/reviews/fundamental-maths-review-2.md'}
    (HERE / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(len(issues), 'issues,', len(new), 'new')


main()
