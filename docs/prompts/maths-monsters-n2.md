Maths Monsters stage N.2: the battle rules (no screens yet).

Where things are:
- School Games Hub repo, worktree ~/projects/school-games-hub-monsters, branch `monsters` (pushed). It is built on `space-maths`, because both change `shared/maths/`. Work only in this worktree: another session uses the main checkout.
- Read docs/MONSTER-PLAN.md first, especially sections 4 (monsters and topics), 5 (battles), 8 (fairness), 10 (stages), the N.1 results and section 12 (my answers). It's the source of truth.
- N.1 is done: six maths topics in shared/maths/skillPacks (index.ts has TOPICS, makePack, topicOfKey). Every banded question can be rebuilt from its key and numbers (BandedPack.rebuild).

Build N.2: `shared/monsters/`, pure TypeScript with no React and no browser APIs, in the same style as shared/space and shared/gem-keep:
1. Types and topics: Leaf = place value, Water = adding and taking away, Fire = times tables, Ice = division, Spark = fractions, Stone = decimals and money. The type wheel is Leaf > Water > Fire > Ice > Spark > Stone > Leaf (×1.5 strong, ×0.75 weak).
2. Monster book: 18 families (3 per type), each growing twice, so 54 entries. Use our own punny maths names, not Pokémon names. Give each stats, attacks (name, power, animation id) and evolve levels. Put the data in one file that's easy to edit, and give me the full name list to OK.
3. Battle engine: a pure function, play(state, action, random) → new state + events. Random numbers are passed in so a battle can be replayed (the N.6 server check). Actions: fight (attack + the answer result: right / quick-right / wrong), switch, bag item, catch (with answer result), run. Damage: right = normal, quick-right = ×1.5, wrong = ¼ with the right answer shown, then type advantage on top. The wild monster attacks back with no question. A quick answer is judged by question difficulty, not as a race. Losing sends the student to the last healing spot with everything kept.
4. Catching (easier at low health, much easier after a right answer; adapt Monster Tamer's idea, MIT, credit it in a comment), exp and levelling, evolving, and a simple AI for wild monsters and trainers.
5. Which question an attack asks: the attacking monster's topic, at the band for the area's difficulty. Catching asks the wild monster's topic. Leave the area-to-band mapping as an easy-to-edit table.
6. A simulator (`npm run monsters:sim`, like space:sim) that plays many battles with pretend students who get 50%, 75% and 90% right. Tune it so: a wild battle is about 3–6 questions and 1–2 minutes; a Tower trainer (3 monsters) is about 10–15 questions; a 50% student still wins most wild battles in the first area; levelling feels steady. Put the results in the plan as "N.2 results", like the other plans do.
7. Tests for the engine: damage, type wheel, catching, exp and evolving, replay gives the same battle, bad actions refused. Run the whole suite and the type check.

Don't build any screens, database or server function yet (N.3 onwards). Commit as you go with clear messages and push `monsters`. Don't merge to main.

When it's done, stop and report back to me in plain, simple words: what you built, the sim numbers, the monster names for me to OK, and any decisions you need from me. Then wait for my go-ahead before N.3 (the battle screen and a test page for me).
