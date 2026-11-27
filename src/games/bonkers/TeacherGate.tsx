/**
 * Before the code switch is on (stage B.5), `/#/bonkers` opens only for teachers, so James can test the gameplay with his
 * own login (27 Nov 2026). Pupils are sent home. The server still checks the class switch on every call.
 */
import { Navigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { GamePage } from '../../pages/GamePage';
import { bonkersQuest } from '.';

export function BonkersTeacherGate() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === 'teacher' ? <GamePage game={bonkersQuest} /> : <Navigate to="/" replace />;
}
