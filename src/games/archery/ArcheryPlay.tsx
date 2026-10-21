/**
 * Archery Challenge in the hub: the whole game, talking to the school's `archery` server function as the signed-in
 * pupil. (The preview runs the same game on a pretend server in the browser.)
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { archeryApi, serverDuelLink, serverTransport } from '../../data/archery';
import { ArcheryGame } from './ArcheryGame';

export function ArcheryPlay() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const api = useMemo(() => archeryApi(serverTransport, profile?.id ?? 'me'), [profile?.id]);
  return <ArcheryGame api={api} duels={serverDuelLink} me={profile?.id ?? ''} onExit={() => navigate('/')} />;
}
