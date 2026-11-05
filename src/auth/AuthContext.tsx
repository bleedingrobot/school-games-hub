import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchMyProfile, FriendlyError, type Profile } from '../data/profile';
import { forgetSettings } from '../data/settingsMemory';
import { supabase } from '../lib/supabase';
import { readSignInError } from './signInErrors';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthState {
  status: AuthStatus;
  profile: Profile | null;
  /** A friendly message to show on the sign-in screen, if any. */
  message: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

/** How long to wait before each extra try at loading the profile. */
export const PROFILE_RETRY_MS = [1000, 2500];

/**
 * Loads the profile, trying again twice if it fails. Failing signs the pupil out, and a junior can only get back in
 * with their QR badge, so one Wi-Fi hiccup while the page starts (or reloads for a new version) mustn't do that.
 */
async function fetchProfileWithRetries(id: string): Promise<Profile> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchMyProfile(id);
    } catch (error) {
      if (attempt >= PROFILE_RETRY_MS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_MS[attempt]));
    }
  }
}

/** Keeps track of who's signed in and loads their profile. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const userId = useRef<string | null>(null);
  const signingOut = useRef(false);

  const loadProfile = useCallback(async (session: Session | null) => {
    if (!session) {
      // Signed out: whoever signs in next on this device reads their own game switches.
      forgetSettings();
      userId.current = null;
      setProfile(null);
      setStatus('signed-out');
      return;
    }
    if (userId.current === session.user.id) return;
    forgetSettings(); // someone else signed in on this device
    userId.current = session.user.id;
    try {
      const profile = await fetchProfileWithRetries(session.user.id);
      if (userId.current !== session.user.id) return; // someone else signed in meanwhile
      setProfile(profile);
      setStatus('signed-in');
    } catch (error) {
      if (userId.current !== session.user.id) return;
      // Signed in but no profile: treat as signed out, with a gentle message.
      userId.current = null;
      await supabase.auth.signOut({ scope: 'local' });
      setProfile(null);
      setMessage(error instanceof FriendlyError ? error.message : 'Something went wrong. Please sign in again.');
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    const problem = readSignInError(window.location.href);
    if (problem) {
      setMessage(problem.message);
      window.history.replaceState(null, '', problem.cleanHref);
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && userId.current && !signingOut.current) {
        setMessage('You were signed out. Please sign in again.');
      }
      signingOut.current = false;
      // Don't call Supabase inside this callback (it can lock up); do it just after.
      setTimeout(() => void loadProfile(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  // Clean the one-time sign-in code out of the address bar once it's been used.
  useEffect(() => {
    if (status !== 'loading' && new URLSearchParams(window.location.search).has('code')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    }
  }, [status]);

  const signIn = useCallback(async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        // No `hd` hint any more: it named one school's domain. The list of schools' domains is on the server,
        // which refuses any account that isn't on it.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setMessage('Sign-in isn\'t working right now. Please try again in a minute.');
  }, []);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    setMessage(null);
    forgetSettings();
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId.current) return;
    try {
      setProfile(await fetchMyProfile(userId.current));
    } catch {
      // Keep showing what we had.
    }
  }, []);

  return (
    <AuthContext.Provider value={{ status, profile, message, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
