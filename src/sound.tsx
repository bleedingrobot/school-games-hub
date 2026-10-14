import { createContext, useContext, useState, type ReactNode } from 'react';

// Sound is OFF until the student turns it on. The choice is remembered on this device only.
const STORAGE_KEY = 'sgh-sound-on';

interface SoundSetting {
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
}

const SoundContext = createContext<SoundSetting>({ soundOn: false, setSoundOn: () => {} });

function readSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundOn, setSoundState] = useState(readSaved);

  function setSoundOn(on: boolean) {
    setSoundState(on);
    try {
      localStorage.setItem(STORAGE_KEY, String(on));
    } catch {
      // Storage blocked: the setting just won't be remembered.
    }
  }

  return <SoundContext.Provider value={{ soundOn, setSoundOn }}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
