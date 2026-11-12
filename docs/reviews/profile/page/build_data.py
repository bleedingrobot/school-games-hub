"""Builds page/data.json for the Profile and Trophies Plan page from the review and the plan.

Run from the repo root: python3 -I docs/reviews/profile/page/build_data.py
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent.parent
PLAN = REPO / 'docs/plans/profile/PLAN.md'
REVIEW = REPO / 'docs/PROFILE-REVIEW.md'
PAGE_URL = 'https://claude.ai/artifact/1tJJiKP48gJBaitmQwUizW'

LEDE = ("The profile page is over four screens long, sign out is at the very bottom, and nothing a child does in a game "
        "changes how they look to anyone else. This plan tidies the page, swaps levels for trophies that last, and makes "
        "the hardest feats in every game win a painted profile picture, with a typed name as the top prize.")

FINDINGS = [
    ('Too long, and sign out is last', 'On a Chromebook the page is 3,219 px tall with 71 things to tap. The child\'s own avatar is two screens down and Sign out is the last thing on the page.'),
    ('Levels: retire them', '100 of 162 pupils are level 1 and one has reached level 7. A level unlocks nothing, classmates never see it, the early-years games give no points, and it is wiped each year. Keep points for "points this week"; let trophies replace the level bar.'),
    ('Achievements are a list, not a reward', '196 kinds across 27 games, shown all at once as an emoji and a name. 115 pupils have at least one; the most is 49. None is visible to classmates.'),
    ('Nothing lasts', 'The yearly New Season wipes most game records. Trophies need their own table that it never touches, written at the moment of the feat.'),
    ('One season for the whole hub', 'The hub gets its own season clock that you set (35 days to start, and you can pause it). Every game\'s trophies use it. Dragon Maths trophies follow the dragon\'s own season: season 1 ends about 21 November, and its five slayers get the first bronze Dragon Heads.'),
    ('Bronze, silver, gold', 'Win a trophy in one season for bronze, a second season for silver, a third for gold. That is the reward for coming back. The hardest feat in each game also unlocks a painted profile picture.'),
    ('A typed name needs a teacher\'s Yes', 'The privacy summary promises no free typing. An earned name is fine if nobody sees it until a teacher approves it, the server checks for rude words, and the summary gets one new line.'),
    ('The best rewards need two games', 'Seven rewards need a feat in two different games, such as slaying the dragon and beating the clan monster in one season. The Name Scroll needs gold trophies in two different games. This pushes pupils to vary their play.'),
    ('Fair for the youngest', 'Early-years rewards come from days played and prizes finished: the game\'s painted friends become profile pictures. No races, no speed, no maths levels on show.'),
]

# id: (kind, title, size, matters, games, wrong, done, why, waits)
CARDS = {
    'P1': ('page', 'Tidy the profile page: sign out at the top', 'S', 'Very high', ['Profile'],
           'The page is over four screens long, everything is open at once, and Sign out is at the bottom.',
           'Avatar, name and Sign out are on the first screen. Everything else is behind closed folds or a "Change my look" button.',
           'Every child signs out of a shared Chromebook every lesson. It should take one tap.', []),
    'P2': ('art', 'Plan and paint the art', 'M', 'High', ['Art'],
           'There is no dragon head, no trophies and no cabinet. Every avatar is made from the same free parts.',
           'An art plan in the repo and about 100 small paintings, approved by James: Dragon Heads first.',
           'It can run tonight on the gaming PC while the code is built. Nothing else waits for it.', []),
    'P3': ('system', 'The trophy system', 'L', 'Very high', ['Database'],
           'There is nowhere to keep a reward that lasts, and the server does not check what picture a pupil wears.',
           'Trophies are given only by the server, survive the yearly New Season, and an earned picture shows wherever the avatar shows.',
           'Everything after this card stands on it.', []),
    'P4': ('game', 'Dragon Maths: the first five and the Dragon Heads', 'M', 'Very high', ['Dragon Maths'],
           'Slaying the dragon first gets a line in a hall of fame and nothing else.',
           'The first five each season wear a bronze, silver or gold Dragon Head. Everyone who slays it gets a Slayer\'s Sword. Season 1\'s five get theirs on day one.',
           'This is the reward you asked for, and season 2 starts about 22 November.', ['P3']),
    'P5': ('page', 'The trophy cabinet and the "New trophy!" moment', 'M', 'Very high', ['Profile'],
           'A pupil has nowhere to see what they have won, and winning something is silent.',
           'A painted shelf on the profile, earned pictures to wear, three "next to win" spots, and a full-screen celebration.',
           'This is what makes a reward visible and feel special.', ['P1', 'P3']),
    'P6': ('page', 'Retire levels and show trophies around the hub', 'M', 'High', ['Home', 'Leaderboard', 'Lobby'],
           'The level bar takes the best spot on the home page and profile, and means little to most pupils.',
           'No level number anywhere. Trophy count and a favourite three in its place, and beside names on the Leaderboard and Lobby.',
           'Classmates seeing a trophy is most of what makes it worth winning.', ['P5']),
    'P7': ('game', 'Trophies for the games that already keep a record', 'L', 'High',
           ['Clan Quest', 'Sky Isles', 'Royal Decree', 'Maths Monsters', 'Star Trader', 'Diamond Drop', 'Toon Flap', 'Gem Keep', 'Mine Runner'],
           'Nine games have a hard end-goal on record but no lasting reward for it.',
           'Each has its trophy and its picture, and pupils who have already done the feat get theirs straight away.',
           'These need no new counting, so they are the quickest way to fill the cabinet.', ['P3']),
    'P8': ('game', 'Trophies that need a new counter or achievement', 'L', 'High',
           ['Chess', 'Checkers', '101', 'Power Clash', 'Wormholes', 'Archery', 'Marble Rush', 'Bond Match', 'Mine Runner', 'Royal Decree', 'Training'],
           'These games have no season record, and Marble Rush and Bond Match have no achievements at all.',
           'Season wins are counted in a table that lasts, and each game has its trophy and picture.',
           'It brings the most-played older games into the cabinet.', ['P3']),
    'P9': ('game', 'The early-years games', 'M', 'High', ['11 early-years games', 'Quick looks'],
           'The youngest pupils earn no points and would have an empty cabinet.',
           'Each golden prize lets a child wear that friend as their picture, with a Garden Cup at 30, 90 and 150 days.',
           'It rewards coming back and finishing, never speed or maths level.', ['P3']),
    'P10': ('system', 'Coming back, two-game rewards and a school hall of fame', 'M', 'Medium', ['Leaderboard'],
            'Nothing marks a new season or remembers past ones, and nothing rewards playing more than one game.',
            'Seven rewards that need feats in two different games, a Season Regular trophy, an All-rounder picture, and a Hall of fame tab that keeps every season\'s winners.',
            'It gives pupils a reason to return each season, to vary what they play, and a place to be remembered.', ['P4']),
    'P11': ('system', 'Earn your own name', 'L', 'High', ['Profile', 'Teacher'],
            'Names can only be picked from two word lists.',
            'A pupil with a Name Scroll types a name; their teacher says Yes or No; nobody sees it before then.',
            'It is the top prize, and the one that most needs care.', ['P3', 'P5']),
    'P12': ('page', 'Teacher tools, the yearly rollover and a last check', 'M', 'Medium', ['Teacher'],
            'Teachers cannot see trophies or reset an avatar, and the year pages do not mention trophies.',
            'Teachers can see, celebrate and tidy up, and the whole thing has been checked as a child would use it.',
            'It closes the plan.', ['P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11']),
}

# The ```text prompts under each "## Pn" heading; "### Part" headings label the parts.
prompts, card, label, buf, inside = {}, None, '', [], False
for ln in PLAN.read_text().splitlines():
    if not inside and ln.startswith('```text'):
        inside, buf = True, []
    elif inside and ln.startswith('```'):
        inside = False
        prompts.setdefault(card, []).append({'label': label, 'text': '\n'.join(buf).strip()})
    elif inside:
        buf.append(ln)
    elif m := re.match(r'## (P\d+) ', ln):
        card, label = m.group(1), ''
    elif ln.startswith('### '):
        label = re.sub(r'^Part \d+:\s*', '', ln[4:].strip())

recs = []
for cid, (kind, title, size, matters, games, wrong, done, why, waits) in CARDS.items():
    parts = prompts.get(cid) or []
    assert parts, f'{cid}: no prompt in the plan'
    r = {'id': cid, 'kind': kind, 'title': title, 'effort': size, 'impact': matters, 'games': games, 'wrong': wrong,
         'done': done, 'why': why, 'waits': waits, 'plan': 'docs/plans/profile/PLAN.md'}
    if len(parts) == 1:
        r['prompt'] = parts[0]['text']
    else:
        r['prompts'] = parts
    recs.append(r)

# The feats table from the review's section 5.
rewards = []
section = REVIEW.read_text().split('## 5. ')[1].split('## 6. ')[0]
for ln in section.splitlines():
    cells = [c.strip() for c in ln.strip().strip('|').split('|')]
    if ln.startswith('|') and len(cells) == 4 and cells[0] not in ('Game', '---'):
        rewards.append({'game': cells[0], 'feat': cells[1], 'picture': cells[2].startswith('**'),
                        'reward': cells[2].replace('**', ''), 'often': cells[3]})
assert len(rewards) > 30, len(rewards)

data = {'lede': LEDE, 'findings': [{'title': t, 'text': x} for t, x in FINDINGS], 'recs': recs, 'rewards': rewards,
        'reportPath': 'docs/PROFILE-REVIEW.md', 'pageUrl': PAGE_URL}
(HERE / 'data.json').write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
print(len(recs), 'cards,', len(rewards), 'rewards')
