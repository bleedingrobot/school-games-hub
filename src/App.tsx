import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { CLAN_QUEST_ON, DRAGON_MATHS_ON, GAMES, POWER_CLASH_ON } from './games/registry';
import { Dashboard } from './pages/Dashboard';
import { FriendGamePage } from './pages/FriendGamePage';
import { GamePage } from './pages/GamePage';
import { HowPoints } from './pages/HowPoints';
import { Leaderboard } from './pages/Leaderboard';
import { Lobby } from './pages/Lobby';
import { NotFound } from './pages/NotFound';
import { Profile } from './pages/Profile';
import { SignIn } from './pages/SignIn';
import { SpaceGamePage } from './pages/SpaceGamePage';
import { CardGamePage } from './pages/CardGamePage';
import { PowerGamePage } from './pages/PowerGamePage';
import { powerClash } from './games/power-clash';
import { dragonMaths } from './games/lord';
import { ClassWarp } from './pages/ClassWarp';
import { MyClasses } from './pages/MyClasses';
import { clanQuest } from './games/clans/game';
import { Teacher } from './pages/Teacher';
import { SoundProvider } from './sound';
import { trainingOn } from './training/switch';

// Training has its own screens and styles, so it loads only when someone opens it.
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
// The maths focus screen brings the whole maths ladder with it, so it loads only when a teacher opens it.
const SetFocus = lazy(() => import('./pages/SetFocus'));

/** All the pages. Links look like /#/chess so GitHub Pages needs no extra setup. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          {GAMES.map((game) => (
            <Route key={game.id} path={game.id} element={<GamePage game={game} />} />
          ))}
          {/* Power Clash always has its address; its dashboard card is behind POWER_CLASH_ON (games/registry.ts). */}
          {!POWER_CLASH_ON && <Route path="power-clash" element={<GamePage game={powerClash} />} />}
          {!DRAGON_MATHS_ON && <Route path="dragon-maths" element={<GamePage game={dragonMaths} />} />}
          {!CLAN_QUEST_ON && <Route path="clan-quest" element={<GamePage game={clanQuest} />} />}
          <Route path="lobby" element={<Lobby />} />
          <Route path="play/:id" element={<FriendGamePage />} />
          <Route path="space-game/:id" element={<SpaceGamePage />} />
          <Route path="card-game/:id" element={<CardGamePage />} />
          <Route path="power-game/:id" element={<PowerGamePage />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          {/* Basic facts training: no address at all until it is switched on (training/switch.ts). */}
          {trainingOn() && (
            <Route
              path="training"
              element={
                <Suspense fallback={<div className="loading" role="status">Loading…</div>}>
                  <TrainingPage />
                </Suspense>
              }
            />
          )}
          <Route path="points" element={<HowPoints />} />
          <Route path="teacher" element={<Teacher />} />
          <Route path="classes" element={<MyClasses />} />
          <Route
            path="focus"
            element={
              <Suspense fallback={<div className="loading" role="status">Loading…</div>}>
                <SetFocus />
              </Suspense>
            }
          />
          <Route path="warp" element={<ClassWarp />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <SoundProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </SoundProvider>
  );
}
