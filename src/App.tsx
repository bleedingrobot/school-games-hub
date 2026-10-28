import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
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
import { ClassSetup } from './pages/MyClasses';
import { clanQuest } from './games/clans/game';
import { TeacherStudents } from './teacher/Students';
import { StudentPage } from './teacher/StudentPage';
import { HardestQuestions } from './teacher/Hardest'; // Today shows its top three, so it's in the teacher bundle anyway
import { TeacherGames } from './teacher/Games';
import { AdminClasses, AdminOverview, AdminStudents, AdminTeachers } from './teacher/Admin';
import { AdminYear } from './teacher/AdminYear';
import { TeacherAdmin, TeacherEntry, TeacherMaths, TeacherShell } from './teacher/TeacherShell';
import { Today } from './teacher/Today';
import { useSkipRuleSync } from './data/questionSkips';
import { SoundProvider } from './sound';
import { trainingOn } from './training/switch';
import { GameGate } from './training/TrainFirst';

// Training has its own screens and styles, so it loads only when someone opens it.
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
// The maths focus screen brings the whole maths ladder with it, so it loads only when a teacher opens it.
const SetFocus = lazy(() => import('./pages/SetFocus'));
// The skill map does too (it colours cells with the same maths the games use).
const SkillMap = lazy(() => import('./pages/SkillMap'));
// So does the warm-up that finds a student's starting place.
const Placement = lazy(() => import('./pages/Placement'));
// The skipped-questions tables, on the teacher's Maths tab.
const QuestionSkipsPanel = lazy(() => import('./pages/TeacherQuestionSkips').then((m) => ({ default: m.QuestionSkipsPanel })));

const loading = <div className="loading" role="status">Loading…</div>;

/**
 * The teacher area (src/teacher/TeacherShell.tsx): the class is in the address, and every page shares one header. The old
 * addresses (/teacher, /classes, /focus?class=, /skills?class=) still work: they open the remembered class on the right tab.
 */
export function teacherRoutes() {
  return (
    <>
      <Route path="teacher" element={<TeacherEntry />} />
      <Route path="classes" element={<TeacherEntry section="setup" />} />
      <Route path="focus" element={<TeacherEntry section="maths" />} />
      <Route path="skills" element={<TeacherEntry section="maths/skills" />} />
      <Route path="teacher/admin" element={<TeacherShell />}>
        <Route element={<TeacherAdmin />}>
          <Route index element={<AdminOverview />} />
          <Route path="classes" element={<AdminClasses />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="year" element={<AdminYear />} />
        </Route>
      </Route>
      <Route path="teacher/:classId" element={<TeacherShell />}>
        <Route index element={<Today />} />
        <Route path="students" element={<TeacherStudents />} />
        <Route path="students/:studentId" element={<StudentPage />} />
        <Route path="maths" element={<TeacherMaths />}>
          <Route index element={<Suspense fallback={loading}><SetFocus /></Suspense>} />
          <Route path="skills" element={<Suspense fallback={loading}><SkillMap /></Suspense>} />
          <Route path="skips" element={<Suspense fallback={loading}><QuestionSkipsPanel /></Suspense>} />
          <Route path="hardest" element={<HardestQuestions />} />
        </Route>
        <Route path="games" element={<TeacherGames />}>
          {/* A game's settings: a drawer over the table on a wide screen, its own page on a narrow one. */}
          <Route path=":gameId" element={null} />
        </Route>
        <Route path="setup" element={<ClassSetup />} />
        <Route path="*" element={<Navigate to=".." relative="path" replace />} />
      </Route>
    </>
  );
}

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
          {/* Starting or joining a classmate game waits for Training too (Training before games); games already going don't. */}
          <Route
            path="lobby"
            element={
              <GameGate>
                <Lobby />
              </GameGate>
            }
          />
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
          {teacherRoutes()}
          <Route path="warp" element={<ClassWarp />} />
          <Route
            path="placement"
            element={
              <Suspense fallback={<div className="loading" role="status">Loading…</div>}>
                <Placement />
              </Suspense>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

/** Hands the class's "Skip button" switch to the question box (src/data/questionSkips.ts). */
function SkipRuleSync() {
  useSkipRuleSync();
  return null;
}

export function App() {
  return (
    <SoundProvider>
      <AuthProvider>
        <HashRouter>
          <SkipRuleSync />
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </SoundProvider>
  );
}
