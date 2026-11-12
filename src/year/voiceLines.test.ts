import { voiceLinesSuite } from "../kit/voiceLinesSuite";
import { allVoiceLines } from "./words";

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/year/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py year.
voiceLinesSuite("year", allVoiceLines, { title: "Year question voice clips" });
