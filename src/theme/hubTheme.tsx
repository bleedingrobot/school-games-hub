/**
 * Which theme a page is shown in (D.4b). Each pupil picks Tidy school, Game menu or Soft and bright on their profile page; it is
 * saved inside their avatar (themeOf). The hub pages show the pupil's pick, the teacher pages always show Tidy school, and the
 * game screens get no theme at all, so every game keeps its own look.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, type HubTheme } from '../avatar/avatarParts';

/** The hub pages: home, profile, lobby, leaderboard, training, Class Warp and How points work. */
const HUB_PAGES = ['/', '/profile', '/lobby', '/leaderboard', '/training', '/warp', '/points'];
/** The teacher's pages: everything under /teacher, and the old addresses that lead there. */
const TEACHER_PAGES = ['/teacher', '/classes', '/focus', '/skills'];

/** The theme for a page, or undefined on a game screen (and any other page, which keeps the site's own look). */
export function pageTheme(pathname: string, chosen: HubTheme): HubTheme | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (HUB_PAGES.includes(path)) return chosen;
  if (TEACHER_PAGES.includes(path) || path.startsWith('/teacher/')) return DEFAULT_THEME;
  return undefined;
}

/** A theme being tried on the profile page before it is saved (null: none, show the saved one). */
interface ThemeTrial {
  trial: HubTheme | null;
  setTrial: (theme: HubTheme | null) => void;
}

const TrialContext = createContext<ThemeTrial>({ trial: null, setTrial: () => {} });

export function ThemeTrialProvider({ children }: { children: ReactNode }) {
  const [trial, setTrial] = useState<HubTheme | null>(null);
  return <TrialContext.Provider value={{ trial, setTrial }}>{children}</TrialContext.Provider>;
}

export const useThemeTrial = () => useContext(TrialContext);
