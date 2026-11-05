/**
 * Royal Decree's deck: the request cards, the riddle lead-ins and the endings.
 * Effects are written [food, gold, happy, safe] in the helper `ch`; zeros are left out.
 * Story chains use `sets` and `needs` flags (kebab-case) so follow-ups only come after the first card was answered a certain way.
 */
import type { Card, Choice, Riddle } from './types';
import type { Meter } from './config';

type Fx = [number, number, number, number];

/** Build a Choice from [food, gold, happy, safe]. */
function ch(label: string, fx: Fx, reply?: string, sets?: string): Choice {
  const names: Meter[] = ['food', 'gold', 'happy', 'safe'];
  const effect: Partial<Record<Meter, number>> = {};
  names.forEach((m, i) => {
    if (fx[i] !== 0) effect[m] = fx[i];
  });
  const c: Choice = { label, effect };
  if (reply) c.reply = reply;
  if (sets) c.sets = sets;
  return c;
}

/** Build a Card: `no` is the left swipe, `yes` the right. */
function card(id: string, who: string, text: string, no: Choice, yes: Choice, extra: Partial<Card> = {}): Card {
  return { id, who, text, no, yes, ...extra };
}

export const CARDS: Card[] = [
  // ---- Hale, the steward ----
  card('steward-roof', 'steward', 'The roof leaks in 4 rooms. Bram says fixing them costs 40 gold coins.',
    ch('Use buckets', [0, 1, -1, 0], 'Plink. Plonk. Plink. The buckets are playing a song.'),
    ch('Fix the roof', [0, -2, 1, 1], 'Lovely and dry! Even the spiders say thanks.')),
  card('steward-flags', 'steward', 'We have 9 old flags. Shall we sew one big new flag for the town fair?',
    ch('Keep the old ones', [1, 1, -1, 0], 'Hale pats the flags. They fall apart a little.'),
    ch('Big new flag!', [0, -1, 1, 0], 'It is so big, three people got lost inside it.')),

  // ---- Marigold, the head farmer ----
  card('reeve-seeds', 'reeve', 'I need 50 bags of seed to plant the big field. Peas, mostly.',
    ch('Plant less', [-1, 1, 0, 0], 'Marigold sighs. The field looks a bit bald.'),
    ch('Buy the seed', [2, -2, 0, 0], 'Pea-rfect! Sorry. Pea-rfect!')),
  card('reeve-crows', 'reeve', 'Crows ate 30 of my turnips! Can we build a very scary scarecrow?',
    ch('Share with crows', [-1, 0, 1, 0], 'The crows sent a thank-you feather. Very polite.'),
    ch('Build one', [2, -1, 0, 0], 'The scarecrow is so scary that even I jumped.')),

  // ---- Nettle, the rat catcher ----
  card('ratcatcher-rats', 'ratcatcher', 'There are 20 rats in the pantry! I have a plan with lots of cheese.',
    ch('They seem polite', [-1, 0, 1, 0], 'One rat is wearing a tiny hat. I cannot catch him now.'),
    ch('Use the plan', [2, -1, 0, 0], 'Done! The rats moved to the barn. They left a note.')),
  card('ratcatcher-flute', 'ratcatcher', 'My magic flute makes rats follow me out of town. It costs 15 gold.',
    ch('Too loud', [-1, 1, 0, 0], 'Nettle puts the flute away. A rat sighs sadly.'),
    ch('Play the flute', [2, -2, 1, 0], 'Everyone danced. Even the rats. Even the cat. Rude cat.')),

  // ---- Quince, the trader ----
  card('trader-cheese', 'trader', 'I will pay 30 gold for 20 wheels of your best cheese.',
    ch('Keep the cheese', [1, 0, -1, 0], 'Quince sulks and counts his coins twice.'),
    ch('Sell the cheese', [-2, 2, 0, 0], 'A good deal! The mice are very upset.')),
  card('trader-road', 'trader', 'A new road to the next town brings 5 more shops. It costs 25 gold.',
    ch('No new road', [0, 1, -1, 0], 'The old road is bumpy. Quince calls it "cosy".'),
    ch('Build the road', [1, -2, 1, 0], 'Five new shops! One only sells hats for dogs.')),

  // ---- Rowan, the healer ----
  card('healer-soup', 'healer', '30 people have the sniffles. I need a giant pot of onion soup!',
    ch('Hanky time', [1, 0, 0, -1], 'ATCHOO! That one was a whopper.'),
    ch('Make the soup', [-1, 0, 1, 1], 'Everyone cried a bit from the onions. Then felt better.')),
  card('healer-garden', 'healer', 'A herb garden would grow 8 kinds of medicine plants. Mint is my favourite.',
    ch('Not now', [0, 1, 0, -1], 'Rowan sniffs a dried leaf and sighs.'),
    ch('Plant it', [1, -1, 0, 2], 'Smells so minty that the whole town breathes better.')),

  // ---- Bram, the builder ----
  card('builder-bridge', 'builder', 'The river bridge has 3 loose planks. Fix it now, or wait for spring?',
    ch('Hop over them', [0, 1, 0, -2], 'Boing! Bram counts four people who fell in.'),
    ch('Fix it now', [0, -1, 0, 2], 'Smooth as a pancake. A very wooden pancake.')),
  card('builder-slide', 'builder', 'Can I build a 10-metre slide down the castle hill? Just for fun!',
    ch('Too slippery', [0, 1, -1, 0], 'Bram pats the hill. It looks disappointed.'),
    ch('Build the slide!', [0, -2, 2, -1], 'WHEEEE! Hale went down 11 times. Hale says he was "inspecting".')),
  card('builder-gap', 'builder', 'The town wall has 5 gaps. Sheep keep walking through to say hello.',
    ch('Welcome, sheep', [1, 1, 0, -1], 'Baaa. Hello sheep.'),
    ch('Patch the gaps', [0, -2, 0, 2], 'The sheep are cross. One baa-ed rudely.')),

  // ---- Pip, the baker ----
  card('baker-pies', 'baker', 'I need 12 sacks of flour for 60 pies. The whole town smells hungry!',
    ch('Not today', [0, 1, -1, 0], 'Pip eats a pie to feel better. Just one. Maybe two.'),
    ch('Yes, bake them!', [2, -2, 0, 0], 'Sixty pies! One has a surprise inside. It is a sock.')),
  card('baker-bell', 'baker', 'My new oven rings a bell when bread is ready. It rings at 4 in the morning.',
    ch('Quiet bread', [-1, 0, 1, 0], 'Pip tiptoes. The bread sulks in the oven.'),
    ch('Keep the bell', [1, 0, -1, 0], 'DING! The whole street is awake and very hungry.')),
  card('baker-pumpkin', 'baker', 'Moss has a pumpkin as big as a cart. It could make 100 pies!',
    ch('Save the seeds', [1, 0, -1, 0], 'Pip is sad. But the seeds are very nice.'),
    ch('Pumpkin pie party', [3, -2, 1, 0], 'Pie for everyone! One slice was shaped like a cat.'),
    { needs: 'giant-pumpkin', from: 8 }),
  card('baker-sprinkles', 'baker', 'I want 5 jars of rainbow sprinkles for the birthday cakes. Pretty please?',
    ch('Plain cakes', [0, 1, -1, 0], 'Plain cakes. Pip pretends it is fine. It is not fine.'),
    ch('Add sprinkles', [0, -1, 1, 0], 'The cakes sparkle! The cat sparkled too, by accident.')),

  // ---- Tama, the fisher ----
  card('fisher-catch', 'fisher', 'I caught 40 fish and one very grumpy boot!',
    ch('Sell the fish', [-1, 2, 0, 0], 'Fish for sale! The boot is not for sale. It is Tama\'s now.'),
    ch('Share them', [2, -1, 1, 0], 'Fish for supper! The boot got a bath.')),
  card('fisher-storm', 'fisher', 'Dark clouds are coming! Should the boats stay in the harbour for 3 days?',
    ch('Fish anyway', [2, 0, 0, -2], 'Splash! The fish were great. The wet socks were not.'),
    ch('Stay safe', [-2, 0, 0, 2], 'Everyone plays cards in the boats. Tama wins 17 times.')),
  card('fisher-net', 'fisher', 'My net has 7 holes. Mostly the fish use them to wave goodbye.',
    ch('Patch it up', [-1, 1, 0, 0], 'Tama ties a knot. Then another. Then eleven more.'),
    ch('Buy a new net', [2, -1, 0, 0], 'The new net is so big it caught a small island.')),

  // ---- Sir Ash, the youngest knight ----
  card('knight-boots', 'knight', '3 knights want new boots. Our old ones let in puddles.',
    ch('Puddle patrol', [0, 1, -1, -1], 'Squelch squelch squelch. The knights march sadly.'),
    ch('Buy boots', [0, -2, 1, 1], 'Shiny boots! Sir Ash jumped in a puddle on purpose.')),
  card('knight-joust', 'knight', 'May we hold a jousting day? Two teams, 20 hobby horses, no real horses!',
    ch('Not this year', [0, 1, -1, 0], 'Sir Ash trots away sadly on his hobby horse.'),
    ch('Joust away!', [0, -1, 2, 0], 'The winning horse was a stick. He got a medal.')),
  card('knight-armour', 'knight', 'My armour squeaks when I walk. Squeak, squeak, squeak, all day!',
    ch('Squeak on', [0, 0, 1, -1], 'Squeak. Every thief hears him coming. Maybe that is good.'),
    ch('Oil the armour', [0, -1, -1, 1], 'Sir Ash sneaks up behind Hale. Hale screams. Oops.')),

  // ---- Old Fern, the castle wizard ----
  card('wizard-rain', 'wizard', 'I can make it rain for 5 days. The crops are thirsty and so am I.',
    ch('Skip the rain', [-1, 0, 1, 0], 'Old Fern sulks. A small grey cloud follows him anyway.'),
    ch('Make it rain', [2, 0, -1, 0], 'Splash! Everyone\'s hair goes frizzy. The crops cheer.')),
  card('wizard-frogs', 'wizard', 'Oops! I turned 6 guards into frogs. Only for an hour, I think.',
    ch('Turn them back', [0, 0, -1, 1], 'Pop! Six guards, slightly green, very embarrassed.'),
    ch('Let them hop', [0, 0, 1, -2], 'Ribbit! The frogs did a great show. The gate is open.')),
  card('wizard-shield', 'wizard', 'A spell can keep the gates strong for a year. It uses 10 gold of sparkle dust.',
    ch('Save the dust', [1, 1, 0, -1], 'Old Fern puts the sparkle dust away. Achoo. Sparkles everywhere.'),
    ch('Cast the spell', [0, -2, 0, 2], 'The gates glow. They hum a happy little tune.')),

  // ---- Hettie, the goat farmer ----
  card('goatherd-garden', 'goatherd', 'My 25 goats want to eat in the royal garden. They asked nicely. Maaa.',
    ch('Not the roses!', [-1, 0, 1, 0], 'The goats look at the roses. Then at you. Then at the roses.'),
    ch('Let them graze', [2, 0, -1, 0], 'The garden is trimmed! Moss is crying a bit.')),
  card('goatherd-cheese', 'goatherd', 'Goat cheese festival! We have 8 kinds of cheese. One is blue and one is bouncy.',
    ch('No festival', [0, 1, -1, 0], 'Hettie nibbles the bouncy cheese. It bounces away.'),
    ch('Cheese party!', [-1, 0, 1, 0], 'Everyone ate cheese. Everyone smelled of cheese. Happy cheese.')),
  card('goatherd-curtains', 'goatherd', 'A goat ate the town hall curtains. She says they were "crunchy".',
    ch('Goat curtains', [0, 1, 0, -1], 'The new curtains are a bit nibbled. Very stylish.'),
    ch('Buy new ones', [0, -1, 1, 0], 'New curtains! The goat is looking at them too.')),

  // ---- Bobbin, the jester ----
  card('jester-show', 'jester', 'I have a new show with 12 jokes. Three are good and one has a wobbly bit.',
    ch('No show', [1, 1, -1, 0], 'Bobbin does one sad cartwheel. Plop.'),
    ch('Big show!', [0, -1, 1, 0], 'Everyone laughed. At joke number 9, a goat laughed too.')),
  card('jester-cushion', 'jester', 'I put a squeaky cushion on the throne. May I do it to the whole council too?',
    ch('Be serious', [0, 0, -1, 1], 'Bobbin sits on his own cushion. Pffft. He is sad.'),
    ch('Squeak them all!', [0, 0, 1, -1], 'Pffft! Hale went the colour of a tomato.')),
  card('jester-eggs', 'jester', 'I can juggle 7 eggs! Please can I borrow 7 eggs?',
    ch('Boo, no eggs', [1, 0, -1, 0], 'Bobbin juggles 7 grapes instead. They are rude to him.'),
    ch('Juggle away', [-1, 0, 1, 0], 'He dropped 5 eggs. Omelette day! Splat.')),

  // ---- Ingrid, the blacksmith ----
  card('smith-shoes', 'smith', 'I need iron for 40 horseshoes. The horses are walking with their toes out.',
    ch('Hmm, later', [-1, 1, 0, 0], 'The horses will use socks. Ingrid is not amused.'),
    ch('Order the iron', [1, -2, 0, 1], 'Clip-clop! The horses are so proud they are prancing.')),
  card('smith-shields', 'smith', 'The guards need 6 shiny new shields. Their old ones are for the cat\'s bed.',
    ch('Old shields do', [1, 1, 0, -1], 'The guards hold up the cat\'s bed. The cat stays inside.'),
    ch('Forge shields', [0, -2, 0, 2], 'Shiny! The guards see themselves in them and wave.')),
  card('smith-bell', 'smith', 'I made a bell as big as a cow. It goes BONG. It is also quite shiny.',
    ch('Too loud', [0, 1, -1, 0], 'Ingrid sulks and gives the bell a tiny tap. bong.'),
    ch('Hang the bell', [0, -1, -1, 2], 'BONG! Everyone jumps. The cat falls off the wall.')),

  // ---- Kit, the young shepherd ----
  card('shepherd-lamb', 'shepherd', 'I counted 100 sheep but 1 is missing! It is on the hill, I think.',
    ch('It will come back', [0, 1, -1, 0], 'The lamb wandered home alone. It was a bit embarrassed.'),
    ch('Send a search', [0, -1, 1, 0], 'Found it! It was in a barrel. It was wearing a barrel.')),
  card('shepherd-wool', 'shepherd', 'We have 60 bags of wool. Shall we knit warm scarves for winter?',
    ch('Sell the wool', [0, 2, -1, 0], 'Kit sighs. The sheep look cold.'),
    ch('Knit the scarves', [0, -1, 1, 1], 'Everyone has a scarf! The tallest one is 7 metres.')),
  card('shepherd-dog', 'shepherd', 'A new sheepdog costs 8 gold. She is very bouncy and loves hats.',
    ch('No dog', [-1, 1, 0, 0], 'The sheep run in circles. Kit runs in circles too.'),
    ch('Get the dog', [1, -1, 0, 0], 'The dog herded all the sheep into the barn. And the mayor.')),

  // ---- Lady Saffron, the spice merchant ----
  card('merchant-spices', 'merchant', 'I have 15 jars of spice from far away. It makes soup taste like a party!',
    ch('No, thank you', [0, 1, -1, 0], 'Lady Saffron sniffs. "Your soup will stay boring."'),
    ch('Buy the spice', [1, -2, 1, 0], 'Achoo! The soup was so tasty. Everyone sneezed.')),
  card('merchant-silk', 'merchant', 'Silk sale! 20 gold of silk for just 10. The market will shimmer!',
    ch('Pass', [0, 1, -1, 0], 'She puts the silk away. It shimmers sadly in the dark.'),
    ch('Buy silk', [-1, -1, 1, 0], 'Everyone looked like a rainbow. The cat wore a silk bow tie.')),

  // ---- Cog, the inventor ----
  card('inventor-wings', 'inventor', 'I built wings out of 12 umbrellas! May I test them off the castle tower?',
    ch('Too high', [0, 0, -1, 1], 'Cog tests them off a chair. Flap. Flap. Small hop.'),
    ch('Test them!', [0, 0, 1, -2], 'Whoosh! Cog flew 3 metres and landed in the haystack.', 'flying-machine')),
  card('inventor-flight', 'inventor', 'Cog\'s wings flew 40 metres and landed in the pond. Fund Wings Mark Two?',
    ch('Stay on the ground', [0, 1, -1, 0], 'Cog pats his wings. They drip a bit.'),
    ch('Fund it', [0, -2, 1, -1], 'Mark Two has a seat belt and a very tiny cup holder.', 'sky-post'),
    { needs: 'flying-machine', from: 8 }),
  card('inventor-washer', 'inventor', 'My machine washes 50 dishes by itself! It also washes the cat. He is not pleased.',
    ch('Wash by hand', [0, 1, -1, 0], 'Pip ends up with 50 soapy plates and bubbles in his hair.'),
    ch('Build it', [0, -1, 1, 0], 'Sparkly plates! The cat is damp and furious, but clean.')),

  // ---- Lark, the musician ----
  card('musician-concert', 'musician', 'Shall I play in the square? 3 songs, and 1 is very long. It has a dancing bit.',
    ch('Not today', [0, 0, -1, 1], 'Lark plays to a pigeon. The pigeon claps.'),
    ch('Play for us!', [-1, 1, 1, 0], 'A snack stall sold out in 5 minutes. Everybody danced.')),
  card('musician-drum', 'musician', 'A new drum costs 9 gold. The old one has a hole in it and a mouse inside.',
    ch('Keep the mouse', [1, 1, -1, 0], 'Boom! Squeak. Boom! Squeak. It is a duet.'),
    ch('Buy the drum', [0, -1, 1, 0], 'BOOM! The mouse now has a tiny drum of its own.')),
  card('musician-lullaby', 'musician', 'I wrote a lullaby so 20 babies sleep. The guards might nap too.',
    ch('No lullaby', [0, 0, -1, 1], 'The babies cry. The guards wake up. Everyone is cranky.'),
    ch('Play it', [0, 0, 1, -1], 'Zzz. Even Captain Bryn nodded off at his post.')),

  // ---- Moss, the royal gardener ----
  card('gardener-seed', 'gardener', 'A magic seed! It might grow a giant pumpkin in 5 days. It drinks 6 buckets a day.',
    ch('Too thirsty', [0, 1, -1, 0], 'Moss sets it on the windowsill. It looks at him sadly.'),
    ch('Plant it!', [0, -1, 1, 0], 'Glug glug. The seed is already making a tiny sprout.', 'giant-pumpkin')),
  card('gardener-pumpkin', 'gardener', 'The pumpkin is as big as a cart! 200 people could eat from it.',
    ch('Pumpkin contest', [-1, 1, 2, 0], 'Contest day! First prize: a very small trophy shaped like a pumpkin.'),
    ch('Pumpkin soup', [3, 0, -1, 0], 'A week of soup! Orange moustaches everywhere.'),
    { needs: 'giant-pumpkin', from: 8 }),
  card('gardener-compost', 'gardener', 'A compost heap of 30 wheelbarrows grows super veggies. It also stinks.',
    ch('Smells too bad', [-1, 0, 1, 0], 'Moss holds his nose and walks away. The heap waves.'),
    ch('Dig it in', [2, 0, -1, 0], 'Phew! But the carrots are as big as my arm.')),
  card('gardener-hedge', 'gardener', 'May I clip the hedge into a dragon? It will need 40 leaves for scales.',
    ch('Plain hedge', [0, 1, -1, 0], 'The hedge stays boring. Moss draws a tiny dragon in the dirt.'),
    ch('Dragon hedge!', [0, -1, 1, 0], 'It looks so real that Wren says hello to it.')),

  // ---- Captain Bryn, the captain of the guard ----
  card('captain-night', 'captain', 'The gates need a 5th guard for the night watch. He snores a bit.',
    ch('Four is enough', [0, 1, 0, -1], 'Four guards watch. They sing songs to stay awake.'),
    ch('Hire him', [0, -1, 0, 2], 'Snore. A new guard stays awake for 20 minutes. Then, snore.')),
  card('captain-parade', 'captain', 'A parade! 30 guards in a straight line. Mostly straight. Sort of.',
    ch('No parade', [0, 0, -1, 1], 'The guards stay on duty. They march on the spot, softly.'),
    ch('March, march!', [0, 0, 1, -1], 'The line wobbled. Bryn did not notice. Everyone cheered.')),
  card('captain-helmet', 'captain', 'A seagull stole my helmet! May I send 3 guards to get it back?',
    ch('Wear a pan', [0, 0, -1, 1], 'Bryn wears a saucepan. It is quite shiny. It dings.'),
    ch('Chase the gull', [0, 0, 1, -1], 'Three guards chased a seagull. The seagull won.')),

  // ---- Ada, the librarian ----
  card('scholar-shelves', 'scholar', 'The library needs 3 new shelves. 200 books are sleeping on the floor.',
    ch('Floor is fine', [1, 1, -1, 0], 'Ada tiptoes around the books. Squeak. Thud. Oops.'),
    ch('Build shelves', [0, -2, 1, 0], 'Every book has a bed now. One book is already snoring.')),
  card('scholar-shh', 'scholar', 'Can we have a "shh" rule on Fridays? Only 1 day a week. Whisper time!',
    ch('No whispering', [0, 0, 1, -1], 'Loud Friday! The library has a drum solo. Ada hides.'),
    ch('Shh Fridays', [0, 0, -1, 1], 'Whisper whisper. The whole town sounds like leaves.')),

  // ---- Rua, the explorer ----
  card('explorer-map', 'explorer', 'I found an old map in a bottle. It shows an X near the old oak. 20 steps from the bridge.',
    ch('Too muddy', [1, 1, -1, 0], 'Rua puts the map in a frame. It says "X". Very nice.'),
    ch('Let\'s dig!', [0, -1, 1, -1], 'Everyone got a shovel. Marigold brought a spoon.', 'treasure-map')),
  card('explorer-dig', 'explorer', 'We dug 3 holes and found an old boot. Shall we dig 2 more holes?',
    ch('No more holes', [0, 0, -1, 1], 'Rua fills the holes. The boot stays. It is a good boot.'),
    ch('Dig, dig, dig!', [0, -1, 1, 0], 'Clang! A shovel hit something metal. Something big.', 'big-treasure'),
    { needs: 'treasure-map', from: 8 }),
  card('explorer-chest', 'explorer', 'The chest is FULL! 200 gold coins and one very old sandwich.',
    ch('Lock the vault', [0, 3, -1, 0], 'The vault is heavy. The sandwich is heavier. We do not eat it.'),
    ch('Throw a party', [-1, 1, 2, 0], 'Party! The sandwich got to be guest of honour.'),
    { needs: 'big-treasure', from: 12 }),

  // ---- Honey, the beekeeper ----
  card('beekeeper-hive', 'beekeeper', 'My bees want 4 new hives. They are already buzzing about it.',
    ch('Too many stings', [-1, 0, 0, 1], 'Honey pats the old hive. Bzzzzt. Fine, fine.'),
    ch('Build hives', [1, -1, 0, 0], 'Bzzz! The bees threw a tiny hive party.', 'bee-hive')),
  card('beekeeper-honey', 'beekeeper', 'We made 100 jars of honey! The bees also made a very tiny crown.',
    ch('Sell the honey', [0, 3, -1, 0], 'The honey sold quickly. The bees kept the crown.'),
    ch('Share the honey', [2, -1, 1, 0], 'Sticky fingers! Sticky doors! Sticky cat! Yum!'),
    { needs: 'bee-hive', from: 8 }),
  card('beekeeper-swarm', 'beekeeper', 'A cloud of 1000 bees landed on the town hall. They are friendly. Mostly.',
    ch('Shoo gently', [0, 0, -1, 1], 'Bzz. The bees leave in a tidy line. One waves.'),
    ch('Let them stay', [1, 0, 1, -1], 'The hall hums a tune. The mayor is wearing a bee hat.')),

  // ---- Wren, the dragon keeper ----
  card('dragonkeeper-egg', 'dragonkeeper', 'I found a big warm egg in the hay! It wobbles when I sing. Can we keep it?',
    ch('Put it back', [0, 0, -1, 1], 'Wren puts the egg back. It rolls out again. Cheeky.'),
    ch('Keep it warm', [-1, 0, 1, 0], 'Wren sings a lullaby to the egg. It wobbles in time.', 'dragon-egg'),
    { from: 3 }),
  card('dragonkeeper-hatch', 'dragonkeeper', 'CRACK! A baby dragon! It is one foot tall and hiccups sparks. It is very hungry.',
    ch('Find it a farm', [1, 0, -2, 0], 'Wren waves goodbye. The baby dragon hiccups a small sad spark.'),
    ch('Adopt it', [-2, 0, 1, 0], 'It ate 4 loaves of bread. Then a candle. Then a sock.', 'baby-dragon'),
    { needs: 'dragon-egg', from: 6 }),
  card('dragonkeeper-grown', 'dragonkeeper', 'The dragon is horse-sized now! She sneezes sparks and keeps 30 houses warm.',
    ch('Too hot!', [0, 0, -1, 1], 'The dragon sulks and sits on the roof to watch.'),
    ch('Warm the town', [1, 0, 1, -1], 'Toasty! She roasted chestnuts too. She burnt one. Sorry!'),
    { needs: 'baby-dragon', from: 12 }),

  // ---- Lupe, the castle cook ----
  card('cook-stew', 'cook', 'Shall I make a stew for 100 people? I need 30 potatoes, 12 carrots and one big spoon.',
    ch('Too much work', [1, 0, -1, 0], 'Lupe stirs a tiny pot. It is for one very small mouse.'),
    ch('Stir the stew', [-2, 0, 1, 0], 'The big spoon was used up. The stew was gone in 10 minutes.')),
  card('cook-cake', 'cook', 'A cake as tall as 3 cats! It needs 40 eggs and a ladder.',
    ch('A small cake', [1, 0, -1, 0], 'A small cake. Lupe says, "Very small." The cat agrees.'),
    ch('Giant cake!', [-2, 0, 2, 0], 'It leaned a bit, like a tower. It still tasted great.')),
  card('cook-feast', 'cook', 'Queen Ysolde is coming! Feast for 50: 8 roast chickens and a mountain of peas.',
    ch('Just sandwiches', [1, 0, -1, 0], 'Sandwiches. The queen ate one in 3 bites. She ate 40.'),
    ch('A grand feast', [-2, 0, 1, 0], 'Chicken! Peas! Even the soup said hello.', 'feast-ready'),
    { needs: 'queen-coming', from: 8 }),

  // ---- Opal, the fortune teller ----
  card('fortune-tea', 'fortune', 'My tea leaves show a big surprise coming. For 5 gold I will look more closely.',
    ch('I like surprises', [0, 1, -1, 0], 'Opal shrugs. "Surprises are better as surprises."'),
    ch('Look closer', [0, -1, 1, 0], 'The tea leaves say: "bird". Opal shrugs. Birds are good.', 'prophecy')),
  card('fortune-bird', 'fortune', 'A small blue bird landed on the castle at noon, just like the tea leaves said!',
    ch('Shoo the bird', [0, 0, -1, 1], 'The bird huffs, flaps once, then lands on Hale.'),
    ch('Feed the bird', [-1, 2, 0, 0], 'It dropped a gold coin. Then it asked for more seed.'),
    { needs: 'prophecy', from: 8 }),
  card('fortune-picnic', 'fortune', 'My crystal ball says it will be sunny for 4 days. Throw a picnic by the river?',
    ch('Stay inside', [1, 0, -1, 0], 'It was sunny. Opal says, "Told you."'),
    ch('Picnic time!', [-1, 0, 1, 0], 'A seagull ate a whole sausage roll. Rude and funny.')),

  // ---- Penny, the tax counter ----
  card('taxman-fountain', 'taxman', 'I counted 90 coins in the wishing fountain! Shall we take them for the treasury?',
    ch('Keep the wishes', [0, -1, 2, 0], 'The wishes stay. Penny sighs and writes "-1".'),
    ch('Take the coins', [1, 2, -1, 0], 'Splash! Penny waded in. She found a frog and 90 coins.')),
  card('taxman-hats', 'taxman', 'A tiny tax on hats: 1 coin each. There are 200 hats in town. Tiny, tiny tax!',
    ch('No hat tax', [0, -1, 1, 0], 'Hats off to the town! Penny puts hers in the bin.'),
    ch('Tax the hats', [1, 3, -2, 0], 'Hats got smaller. One wore a thimble.')),

  // ---- Dash, the circus ringmaster ----
  card('ringmaster-circus', 'ringmaster', 'The circus has 4 elephants, 12 clowns and 1 clever flea! May we stay for 3 days?',
    ch('Not now', [1, 0, -1, 0], 'The elephants droop. The flea tips its tiny hat.'),
    ch('Come in!', [-2, 1, 2, 0], 'Clowns in the fountain! The flea jumped over a bread roll.', 'circus-came')),
  card('ringmaster-return', 'ringmaster', 'We\'re back! New trick: a cannon that shoots confetti. 20 tickets for 10 gold?',
    ch('Sorry, no', [0, 0, -1, 1], 'Dash puts the cannon away. A little confetti falls out. Poof.'),
    ch('Fire the cannon', [1, 2, 0, -1], 'Pop! Confetti in everyone\'s hair. The cat is covered. Pink.'),
    { needs: 'circus-came', from: 12 }),

  // ---- Ox, the miller ----
  card('miller-wheel', 'miller', 'The mill wheel turns slowly and 30 sacks of wheat are waiting.',
    ch('Wait a bit', [-1, 1, 0, 0], 'The wheat waits. The wheel spins. The wheat dozes.'),
    ch('Oil the wheel', [2, -1, 0, 0], 'Whirr! The new squeak goes "eeeee". Everyone likes it.')),
  card('miller-windmill', 'miller', 'A second windmill would grind twice the flour. It is three times taller than me.',
    ch('One is enough', [-1, 1, 0, 0], 'Ox sighs. The first windmill gets a pat.'),
    ch('Build it', [2, -2, 1, 0], 'Whoosh! Two windmills! The town feels fresh and floury.')),

  // ---- Sir Whiskers, the royal cat ----
  card('cat-throne', 'cat', 'Meow. (Sir Whiskers wants the throne for 1 hour. He is already sitting on it.)',
    ch('Down, please', [0, 0, -1, 1], 'Sir Whiskers walks off. He flicks his tail like a very rude cape.'),
    ch('Cat day!', [0, 0, 1, -1], 'The cat wears the crown. He looks very pleased. Purr.', 'cat-king')),
  card('cat-laws', 'cat', 'Meow. (Sir Whiskers has made 5 laws: fish for cats, naps at noon, and belly rubs.)',
    ch('No cat laws', [1, 0, -1, 0], 'The cat gives a long, hard stare. Then he sits on your shoes.'),
    ch('Pass the laws', [-1, 0, 1, 0], 'Everyone naps at noon. The cat naps hardest.'),
    { needs: 'cat-king', from: 8 }),
  card('cat-fish', 'cat', 'Meow. (7 fish are missing from the kitchen. There is fur on the table.)',
    ch('Hide the fish', [1, 0, -1, 0], 'The cat finds them anyway. Behind the cabbages.'),
    ch('Share the fish', [-1, 0, 1, 0], 'Purrrr. The cat has a very round tummy.')),

  // ---- Zip, the messenger ----
  card('messenger-news', 'messenger', 'News from 3 villages! Reading it takes 1 hour. All of it is very exciting. Probably.',
    ch('Just headlines', [0, 0, 1, -1], 'Zip speed-reads: "Cows. Rain. Cows. The end." Good news.'),
    ch('Read it all', [0, 0, -1, 1], 'Village 2 had a cow who sang. Village 3 had a cow who didn\'t.')),
  card('messenger-boots', 'messenger', 'I ran 50 kilometres today! My boots have holes. My toes wave hello to everyone.',
    ch('Wear thick socks', [0, 1, 0, -1], 'Zip wears 5 socks. He is not very fast now.'),
    ch('Buy boots', [0, -1, 1, 0], 'Fast boots! Zip zoomed past and left a trail of dust.')),
  card('messenger-sky', 'messenger', 'Cog\'s wings now carry my letters! 6 letters flew in 1 hour and one landed on a goat.',
    ch('Keep walking', [0, 1, -1, 0], 'Zip trots on. The goat keeps the letter.'),
    ch('Fund sky post', [0, -1, 1, 1], 'Letters raced overhead! Zip waves from below.'),
    { needs: 'sky-post', from: 12 }),

  // ---- Queen Ysolde, the queen next door ----
  card('queen-visit', 'queen', 'Queen Ysolde would like to visit Riverstone with her 12 coaches. May she come?',
    ch('Not this time', [0, 0, -1, 1], 'The queen writes back: "How rude! Well, fine. Another time."'),
    ch('Welcome her!', [0, -1, 1, 0], 'The red carpet comes out. It was a bit short, so we used a blanket.', 'queen-coming'),
    { from: 6 }),
  card('queen-trade', 'queen', 'My kingdom has 40 wheels of cheese. Yours has 40 pies. Shall we swap for a week?',
    ch('Keep our pies', [1, 0, -1, 0], 'The queen sniffs. "Fine." She takes only 1 pie. Then 2.'),
    ch('Swap!', [-1, 1, 1, 0], 'We swapped. Cheese pie! Pie cheese! Very cheesy.')),
  card('queen-return', 'queen', 'Your feast was the best ever! May we trade grain, 2 boats a month, as friends?',
    ch('Thank you, no', [0, 1, -1, 0], 'The queen smiles. "Perhaps one day." She takes a pie.'),
    ch('Be friends', [2, -1, 1, 0], 'The queen cheered. The grain boat is called "Pie Friend".'),
    { needs: 'feast-ready', from: 12 }),

  // ---- Gilbert, the friendly castle ghost ----
  card('ghost-necklace', 'ghost', 'Whoooo... I lost my silver necklace 100 years ago. May we search the cellar?',
    ch('Maybe later', [0, 1, -1, 0], 'Gilbert floats off, singing a tiny sad song.'),
    ch('Search the cellar', [0, -1, 1, 0], 'We found 3 spoons, 2 socks and an old key. No necklace.', 'lost-necklace')),
  card('ghost-found', 'ghost', 'You found it! It was in a sock! Shall I haunt only on Tuesdays, or throw a ghost party?',
    ch('Quiet Tuesdays', [0, 0, -1, 1], 'Gilbert smiles. Only Tuesdays: "Boooo, but quietly."'),
    ch('Ghost party!', [-1, 0, 1, -1], 'The party was spooky and silly. Even the cat danced. Wooo!'),
    { needs: 'lost-necklace', from: 8 }),
  card('ghost-boo', 'ghost', 'I practised my BOO 8 times. It sounds like a sneeze. May I try on the guards?',
    ch('Boo a pillow', [0, 0, -1, 1], 'Gilbert booed the pillow. The pillow did not mind.'),
    ch('Boo the guards', [0, 0, 1, -1], 'Achoo-OOO! Bryn jumped 2 metres. Then he laughed.')),
];

export const RIDDLES: Riddle[] = [
  { who: 'steward', ask: 'The castle books are in a muddle. Could you help me with this sum?', meter: 'gold', thanks: 'Splendid! The books balance. Hale does a happy hop.' },
  { who: 'reeve', ask: 'My farm needs counting before the sun sets. Can you help me with this?', meter: 'food', thanks: 'That\'s it! The harvest is all counted. Lovely.' },
  { who: 'ratcatcher', ask: 'I counted the rats three times and got three answers. Help me with this?', meter: 'safe', thanks: 'Right! One less problem. Squeak, said the rat.' },
  { who: 'trader', ask: 'A customer is waiting and my head is in a spin. Can you help me work this out?', meter: 'gold', thanks: 'Ha! You are a better trader than me. Here is a coin.' },
  { who: 'healer', ask: 'I am mixing up the medicine and need to be careful. Can you help me with this?', meter: 'safe', thanks: 'Just right! Everyone will feel better soon.' },
  { who: 'builder', ask: 'I need to measure twice and cut once. Can you help me work this out?', meter: 'safe', thanks: 'Perfect fit! Bram hammers in a nail and then another.' },
  { who: 'baker', ask: 'My oven is hot and my head is hotter. Can you help me with this sum?', meter: 'food', thanks: 'Yes! Extra pies for everyone. Thank you!' },
  { who: 'fisher', ask: 'The tide is coming in and I need an answer fast. Can you help me with this?', meter: 'food', thanks: 'Hooray! You\'re a real catch. Here is a fish.' },
  { who: 'knight', ask: 'Even brave knights need help sometimes. Can you help me with this one?', meter: 'safe', thanks: 'Brilliant! I knew you would know. Hip hip hooray!' },
  { who: 'wizard', ask: 'My spell needs an exact number or it all goes funny. Can you help me?', meter: 'safe', thanks: 'Abracadabra! It worked. No more frogs. For now.' },
  { who: 'goatherd', ask: 'My goats keep moving and I keep losing count. Can you help me with this?', meter: 'food', thanks: 'Maaa-vellous! Thank you. The goats are impressed.' },
  { who: 'jester', ask: 'I have a joke but the answer is a number. Can you help me work it out?', meter: 'happy', thanks: 'Ha ha! The best punchline: you got it right!' },
  { who: 'smith', ask: 'The iron is hot, so I need to be quick. Can you help me with this sum?', meter: 'safe', thanks: 'Spot on! Ingrid hits the anvil with joy. Clang!' },
  { who: 'shepherd', ask: 'The sheep got muddled again. Can you help me count and work this out?', meter: 'food', thanks: 'Baa-rilliant! All the sheep clapped. Sort of.' },
  { who: 'merchant', ask: 'My customers are waiting and my spices are spilling. Can you help me with this?', meter: 'gold', thanks: 'Wonderful! A pinch of gold for you.' },
  { who: 'inventor', ask: 'My latest invention needs the right numbers. Can you help me check this?', meter: 'happy', thanks: 'It works! Whirr, whirr, ding! Thank you!' },
  { who: 'musician', ask: 'I am counting beats in my song and lost my place. Can you help me with this?', meter: 'happy', thanks: 'One, two, three, four! You\'re in tune with maths!' },
  { who: 'gardener', ask: 'The plants need exact amounts of water. Can you help me work this out?', meter: 'food', thanks: 'The seeds are happy. So am I. Thank you!' },
  { who: 'captain', ask: 'The guards are lined up and I need to check the numbers. Can you help me?', meter: 'safe', thanks: 'Spot on! Not a number out of place. Well done!' },
  { who: 'scholar', ask: 'This book has a puzzle and the answer is a number. Can you help me?', meter: 'happy', thanks: 'Correct! Ada gives a very quiet, very happy cheer. Shhh!' },
  { who: 'explorer', ask: 'The map is blotchy and I need some numbers to read it. Can you help me?', meter: 'gold', thanks: 'You found it! X marks the spot. Rua high-fives you.' },
  { who: 'beekeeper', ask: 'My bees have been busy and I lost count. Can you help me with this sum?', meter: 'food', thanks: 'Bzzz-illiant! A jar of honey for you!' },
  { who: 'dragonkeeper', ask: 'My dragon wants an answer before she sneezes. Can you help me with this?', meter: 'happy', thanks: 'Roar-some! The dragon is doing a happy wiggle.' },
  { who: 'cook', ask: 'The soup pot is bubbling and I cannot find my glasses. Can you help me?', meter: 'food', thanks: 'Delicious answer! Lupe gives you a spoon of soup.' },
  { who: 'fortune', ask: 'My crystal ball is fuzzy today. Can you help me find this answer?', meter: 'happy', thanks: 'The ball says: "You are very clever!" It is never wrong.' },
  { who: 'taxman', ask: 'I have a very long list of coins. Can you help me with this one?', meter: 'gold', thanks: 'Right to the penny! Penny is delighted. Cling!' },
  { who: 'ringmaster', ask: 'The show starts in five minutes and the numbers are mixed up! Can you help me?', meter: 'happy', thanks: 'Ta-da! The show goes on! Thanks to you!' },
  { who: 'miller', ask: 'The flour is piling up and my head is dusty. Can you help me with this?', meter: 'food', thanks: 'Flour-ishing! That is correct. Thank you, Ox pats your back.' },
  { who: 'cat', ask: 'Meow. (Sir Whiskers pushes a number puzzle off the table. Help him with it?)', meter: 'happy', thanks: 'Purrrr. (He knocks over a vase to say thank you.)' },
  { who: 'messenger', ask: 'I have a message to send, but it has numbers in it. Can you help me?', meter: 'safe', thanks: 'Message sent! Zip zoomed off in a puff of dust.' },
  { who: 'queen', ask: 'A royal puzzle for you, my young friend. Can you help me with this one?', meter: 'gold', thanks: 'How clever! Riverstone is lucky to have you.' },
  { who: 'ghost', ask: 'I have been floating over this puzzle for 100 years. Can you help me?', meter: 'happy', thanks: 'Wooo-hoo! Gilbert does a spooky spin of joy.' },
];

export const ENDINGS: Record<'food' | 'gold' | 'happy' | 'safe' | 'full', { title: string; text: string }> = {
  food: {
    title: 'The Very Long Picnic',
    text: 'Riverstone ran out of food. Everyone packed a blanket and set off on a very long picnic to find more. You led the way, and there was plenty of cheese.',
  },
  gold: {
    title: 'The Empty Treasure Chest',
    text: 'The treasure chest echoed. The town made a deal: you take a long holiday while they save up. Nobody minded. They even made you a thank-you hat.',
  },
  happy: {
    title: 'The Great Grumpy Day',
    text: 'Everybody got a bit grumpy and stayed home with a good book. You went to a seaside to find some fun. Next time, more cake and tickles!',
  },
  safe: {
    title: 'The Wobbly Castle',
    text: 'The castle gates wobbled, the bridge creaked and the guards napped. You moved to a snug little cottage nearby, with a very strong door.',
  },
  full: {
    title: 'The Golden Celebration',
    text: 'Six whole years! Riverstone throws a golden party with fireworks, pie and the cat in a crown. Everyone cheers for the best ruler ever. Hooray!',
  },
};
