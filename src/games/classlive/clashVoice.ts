/**
 * Colour Clash's Bella lines (docs/CLASH-PLAN.md), spread into LINES and HOWTO in voiceLines.ts (kept here so the Class
 * Live games built side by side don't edit the same lines). No numbers in lines with clips except spelled-out ones.
 */
export const CLASH_LINES = {
  clashStart: ['Colour Clash is on! Run over the floor to paint it your colour!', 'Get ready to paint! Cover the floor in your team colour!', 'Here we go! Paint everything you can!'],
  clashReady: ['Fresh floor! Get ready to paint!', 'New round! Find an empty patch and paint it!', 'Get ready, painters!'],
  clashTen: ['Ten seconds left! Splat, splat, splat!', 'Ten seconds! Keep painting!', 'Nearly time! Ten seconds to go!'],
  clashCount: ["Time's up! Let's count the paint!", 'Brushes down! Who painted the most?', 'Stop! Let us see who covered the most floor!'],
  clashTie: ["It's a tie! What a battle!", 'Too close to call. It is a tie!', 'Exactly the same! A tie!'],
  clashWinRed: ['Red wins the round!', 'The red team takes it!', 'Red! Red painted the most!'],
  clashWinBlue: ['Blue wins the round!', 'The blue team takes it!', 'Blue! Blue painted the most!'],
  clashWinGreen: ['Green wins the round!', 'The green team takes it!', 'Green! Green painted the most!'],
  clashWinYellow: ['Yellow wins the round!', 'The yellow team takes it!', 'Yellow! Yellow painted the most!'],
  clash_items: ['Power-ups have appeared! Run over one, then drop a paint bomb to switch it on.'],
  clash_golden: ['Golden tiles! Each golden tile counts three. Paint them last!'],
  clash_portal: ['Portals! Step into one and pop out of the other.'],
  clash_goo: ['Watch out for the sticky patches. They slow you down!'],
  clash_slip: ['Slippery paint! You will slide and you cannot stop fast.'],
  clash_roller: ['Rollers are coming! Get hit and you go flying!'],
  clash_fountain: ['A fountain in the middle! Go round it. Nobody can paint it.'],
} as const;

export const CLASH_HOWTO = [
  'You are on a colour team. Move your avatar with the joystick, or the arrow keys.',
  'Every tile you run over turns your team colour.',
  'Tap the bomb and answer a question. Get it right to splat your colour all around you! You stand still while you answer.',
  'Get answers right in a row for a bigger splat.',
  'When the time is up we count the paint. The team that wins the most rounds wins!',
] as const;
