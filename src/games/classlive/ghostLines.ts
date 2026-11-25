/**
 * Ghost Tag's Bella lines (docs/GHOST-PLAN.md), spread into LINES and the clip list in voiceLines.ts. No names, no
 * numbers, so every line has a clip. A few takes each, said in turn.
 */
export const GHOST_LINES = {
  ghostStart: ['Ghost Tag is on! Run from the ghosts!', 'Here we go! Do not let the ghosts catch you!', 'The ghosts are waking up. Run!'],
  ghostRound: ['New round! New ghosts!', 'Everyone back! The ghosts are in the crypt.', 'Get ready for the next round!'],
  ghostHunt: ['Ghosts, go and get them!', 'The ghosts are out! Run!', 'Here they come! Run, run, run!'],
  ghostTag: ['Caught! Another ghost!', 'Boo! Got one!', 'Oh no, you are a ghost now!', 'Another one joins the ghosts!'],
  ghostVanish: ['Poof! Invisible!', 'Now you see them, now you do not!', 'Vanished!'],
  ghostLantern: ['A ghost lit its lantern!', 'The lantern can see invisible players!', 'Lantern on!'],
  ghostDash: ['Ghost dash!', 'Whoosh! A ghost is speeding!', 'Watch out, a speedy ghost!'],
  ghostBounce: ['Garlic! The ghost bounced off!', 'Ha! The garlic shield worked!', 'Bounced! Garlic saves the day!'],
  ghostFreeze: ['Frost bomb! The ghosts are frozen!', 'Brrr! Frozen ghosts!', 'Freeze! The ghosts cannot move!'],
  ghostTwoLeft: ['Only two left!', 'Just two players left!', 'Two left! Who will win?'],
  ghostLast: ['The last one standing wins the round!', 'We have a winner! The last one standing!', 'Last one standing! Amazing!'],
  ghostTime: ['Time is up! Everyone still running wins the round!', 'That is the round! The survivors win!', 'Round over! Well done, survivors!'],
  ghostAll: ['The ghosts caught everyone!', 'Everyone is a ghost! Spooky!', 'The ghosts win this round!'],
  ghostHurry: ['Ten seconds left in this round!', 'Hang on, nearly there!', 'Ten more seconds!'],
  mech_ghost_items: ['Power-ups! Run over one to grab it.'],
  mech_ghost_teleport: ['Teleports! Step in one to pop out of the other.'],
  mech_ghost_slow: ['Sticky patches! They slow you down, but not the ghosts.'],
  mech_ghost_fog: ['Fog! The big screen cannot see far. Use your device!'],
  mech_ghost_bats: ['Watch out! Something swoops across the map and knocks you flying.'],
} as const;

/** How to play (HowTo.tsx). */
export const GHOST_HOWTO = [
  'Move your avatar with the joystick, or the arrow keys.',
  'A few players start as ghosts. If a ghost touches you, you become a ghost too.',
  'Answer a question right to turn invisible for five seconds. Ghosts cannot catch you then!',
  'Ghosts answer questions too, for a speed dash or a lantern that finds invisible players.',
  'The last one standing wins the round. Win the most rounds to win the game!',
] as const;
