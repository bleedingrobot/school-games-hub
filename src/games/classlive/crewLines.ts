/**
 * Glitches' Bella lines (docs/CREW-PLAN.md): Bella is the factory computer. Spread into LINES and the clip list in
 * voiceLines.ts. No names and no numbers, so every line has a clip; Bella never says who voted for whom, and the
 * reveal is only "That was a Glitch" or "That was Crew" (names stay on the screen). A few takes each, said in turn.
 */
export const CREW_LINES = {
  crewStart: ['Beep boop! Welcome to the robot factory. Check your role!', 'Factory computer online. Look at your device to see your role!', 'Good morning, crew! Some of you are secretly Glitches. Shh!'],
  crewRound: ['New shift! New roles! Check your device.', 'Everyone back to the canteen. New roles are ready!', 'Next shift starting. Who are the Glitches this time?'],
  crewWork: ['Shift started! Do your jobs and keep the factory running!', 'Machines on! Get to work, crew!', 'Off you go! Fill up the power bar!'],
  crewSpark: ['Beep! A machine is sparking!', 'Warning! Machine down!', 'Uh oh, sparks! Fix that machine!', 'Alert! Something has been jammed!'],
  crewMend: ['Machine fixed! Great work!', 'Mended! Back to full power!', 'Sparks gone. Nice fixing!'],
  crewDark: ['Lights out! Somebody flicked the switch!', 'Power cut! It is dark in here!', 'Who turned off the lights?'],
  crewLight: ['Lights back on! Thank you!', 'The control room fixed the lights!', 'Bright again!'],
  crewThree: ['Three machines are sparking! Time for a meeting?', 'Danger! Three machines are down!', 'The factory is in trouble! Three machines are sparking!'],
  crewMeeting: ['Emergency meeting in the canteen!', 'Alarm! Everyone to the canteen!', 'Stop work! Meeting time!'],
  crewTalk: ['Talk it over. Who was near the sparking machines?', 'Share what you saw. Be kind, and use your clues!', 'Time to talk. Who is the Glitch?'],
  crewVote: ['Vote now on your device. It is a secret!', 'Voting time! Pick someone, or skip.', 'Cast your secret vote!'],
  crewGlitch: ['That was a Glitch! Well spotted!', 'Glitch found! Beep boop, drone mode on!', 'Yes! That was a Glitch!'],
  crewCrew: ['Oh no, that was Crew! Drone mode on.', 'That was not a Glitch. That was Crew!', 'Whoops! That was a crew member.'],
  crewNobody: ['Nobody was sent off. Back to work!', 'No one was picked. Keep your eyes open!', 'A tie! Nobody leaves. Back to work!'],
  crewWinPower: ['Full power! The crew win the round!', 'The factory is powered up! Crew win!', 'Power bar full! Brilliant work, crew!'],
  crewWinFound: ['Every Glitch was found! The crew win!', 'All the Glitches are drones now. Crew win!', 'Great detective work! The crew win!'],
  crewWinJammed: ['Four machines jammed! The Glitches win the round!', 'The factory has stopped! Glitches win!', 'Too many sparks! The Glitches win!'],
  crewWinTime: ['Shift over, and the power bar is not full. The Glitches win!', 'Time is up! The Glitches win this round!', 'The clock ran out. Glitches win!'],
  crewWinMany: ['The Glitches have taken over the factory! Glitches win!', 'There are as many Glitches as crew. Glitches win!', 'The Glitches win this round!'],
  crewHurry: ['Thirty seconds left in this shift!', 'Hurry, the shift is nearly over!', 'Quick! Fill that power bar!'],
  mech_crew_items: ['Power-ups in the factory! Grab one, then answer a question to switch it on.'],
  mech_crew_lights: ['New trick! The Glitches can turn off the lights. Fix them in the control room.'],
  mech_crew_belts: ['Conveyor belts! They carry you along. Watch your step!'],
} as const;

/** How to play (HowTo.tsx). */
export const CREW_HOWTO = [
  'Steer your robot worker with the joystick, or the arrow keys.',
  'Check your device: most of you are crew, but a few are secret Glitches.',
  'Crew: go to your jobs and answer questions to fill the power bar. Fix sparking machines too!',
  'Glitches: sneak up to a machine and jam it. It starts sparking a few seconds later.',
  'Your teacher calls a meeting. Talk it over, then vote in secret. Fill the power bar, or find every Glitch, to win!',
] as const;
