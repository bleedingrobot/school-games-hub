import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { GAMES } from './games/registry';
import { Dashboard } from './pages/Dashboard';
import { GamePage } from './pages/GamePage';
import { Leaderboard } from './pages/Leaderboard';
import { Lobby } from './pages/Lobby';
import { NotFound } from './pages/NotFound';
import { Profile } from './pages/Profile';
import { SignIn } from './pages/SignIn';
import { SoundProvider } from './sound';

/** All the pages. Links look like /#/chess so GitHub Pages needs no extra setup. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {GAMES.map((game) => (
          <Route key={game.id} path={game.id} element={<GamePage game={game} />} />
        ))}
        <Route path="lobby" element={<Lobby />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <SoundProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </SoundProvider>
  );
}
