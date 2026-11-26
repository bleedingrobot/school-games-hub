import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { CLAN_QUEST_ON, DRAGON_MATHS_ON, GAMES, POWER_CLASH_ON } from './games/registry';
import { showdownOn } from './games/showdown/switch';
import { classliveOn } from './games/classlive/switch';
import { Dashboard } from './pages/Dashboard';
import { GamePage } from './pages/GamePage';
import { NotFound } from './pages/NotFound';
import { SignIn } from './pages/SignIn';
import { powerClash } from './games/power-clash';
import { dragonMaths } from './games/lord';
import { clanQuest } from './games/clans/game';
import { useSkipRuleSync } from './data/questionSkips';
import { useQuestionFeedbackSync } from './data/questionFeedback';
import { SoundProvider } from './sound';
import { activitiesOn } from './activities/switch';
import { trainingOn } from './training/switch';
import { GameGate } from './training/TrainFirst';
import { NonMathsGate } from './components/NonMathsGate';

// Every page but the home page, the games and sign-in loads when it is opened, so the home page downloads less (dashboard
// plan D7). Layout and the teacher area wait for them with a Loading line under their own header.
const FriendGamePage = lazy(() => import('./pages/FriendGamePage').then((m) => ({ default: m.FriendGamePage })));
const Activities = lazy(() => import('./activities/ActivitiesPage').then((m) => ({ default: m.Activities })));
const HowPoints = lazy(() => import('./pages/HowPoints').then((m) => ({ default: m.HowPoints })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then((m) => ({ default: m.Leaderboard })));
const Lobby = lazy(() => import('./pages/Lobby').then((m) => ({ default: m.Lobby })));
const AchievementHall = lazy(() => import('./achievements/AchievementHall').then((m) => ({ default: m.AchievementHall })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const BadgeSignIn = lazy(() => import('./pages/BadgeSignIn').then((m) => ({ default: m.BadgeSignIn })));
const SpaceGamePage = lazy(() => import('./pages/SpaceGamePage').then((m) => ({ default: m.SpaceGamePage })));
const CardGamePage = lazy(() => import('./pages/CardGamePage').then((m) => ({ default: m.CardGamePage })));
const PowerGamePage = lazy(() => import('./pages/PowerGamePage').then((m) => ({ default: m.PowerGamePage })));
const ClassWarp = lazy(() => import('./pages/ClassWarp').then((m) => ({ default: m.ClassWarp })));
const ClassSetup = lazy(() => import('./pages/MyClasses').then((m) => ({ default: m.ClassSetup })));
const TeacherStudents = lazy(() => import('./teacher/Students').then((m) => ({ default: m.TeacherStudents })));
const StudentPage = lazy(() => import('./teacher/StudentPage').then((m) => ({ default: m.StudentPage })));
const BadgeSheet = lazy(() => import('./teacher/BadgeSheet').then((m) => ({ default: m.BadgeSheet })));
const AddPupils = lazy(() => import('./teacher/AddPupils').then((m) => ({ default: m.AddPupils })));
const HardestQuestions = lazy(() => import('./teacher/Hardest').then((m) => ({ default: m.HardestQuestions })));
const TeacherShowdown = lazy(() => import('./pages/TeacherShowdown').then((m) => ({ default: m.TeacherShowdown })));
const TeacherClassLive = lazy(() => import('./pages/TeacherClassLive').then((m) => ({ default: m.TeacherClassLive })));
const TeacherQuests = lazy(() => import('./quests/TeacherQuests').then((m) => ({ default: m.TeacherQuests })));
const Year78Taught = lazy(() => import('./teacher/Year78').then((m) => ({ default: m.Year78Taught })));
const TeacherGames = lazy(() => import('./teacher/Games').then((m) => ({ default: m.TeacherGames })));
const AdminFeedback = lazy(() => import('./teacher/AdminFeedback').then((m) => ({ default: m.AdminFeedback })));
const AdminYear = lazy(() => import('./teacher/AdminYear').then((m) => ({ default: m.AdminYear })));
const TeacherPulse = lazy(() => import('./teacher/pulse/Pulse').then((m) => ({ default: m.TeacherPulse })));
const Today = lazy(() => import('./teacher/Today').then((m) => ({ default: m.Today })));
const AdminClasses = lazy(() => import('./teacher/Admin').then((m) => ({ default: m.AdminClasses })));
const AdminClassLive = lazy(() => import('./teacher/AdminClassLive').then((m) => ({ default: m.AdminClassLive })));
const AdminDefaults = lazy(() => import('./teacher/Admin').then((m) => ({ default: m.AdminDefaults })));
const AdminOverview = lazy(() => import('./teacher/Admin').then((m) => ({ default: m.AdminOverview })));
const AdminStudents = lazy(() => import('./teacher/Admin').then((m) => ({ default: m.AdminStudents })));
const AdminTeachers = lazy(() => import('./teacher/Admin').then((m) => ({ default: m.AdminTeachers })));
const TeacherAdmin = lazy(() => import('./teacher/TeacherShell').then((m) => ({ default: m.TeacherAdmin })));
const TeacherEntry = lazy(() => import('./teacher/TeacherShell').then((m) => ({ default: m.TeacherEntry })));
const TeacherMaths = lazy(() => import('./teacher/TeacherShell').then((m) => ({ default: m.TeacherMaths })));
const TeacherShell = lazy(() => import('./teacher/TeacherShell').then((m) => ({ default: m.TeacherShell })));
// Training has its own screens and styles, so it loads only when someone opens it.
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
// The maths focus screen brings the whole maths ladder with it, so it loads only when a teacher opens it.
const SetFocus = lazy(() => import('./pages/SetFocus'));
// The skill map does too (it colours cells with the same maths the games use).
const SkillMap = lazy(() => import('./pages/SkillMap'));
const Progress = lazy(() => import('./teacher/progress/Progress'));
const FoundationalSkills = lazy(() => import('./teacher/foundational/FoundationalSkills'));
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
      {showdownOn() && <Route path="teacher/showdown" element={<TeacherEntry section="showdown" />} />}
      {classliveOn() && <Route path="teacher/classlive" element={<TeacherEntry section="classlive" />} />}
      <Route path="teacher/admin" element={<TeacherShell />}>
        <Route element={<TeacherAdmin />}>
          <Route index element={<AdminOverview />} />
          <Route path="classes" element={<AdminClasses />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="defaults" element={<AdminDefaults />} />
          {classliveOn() && <Route path="classlive" element={<AdminClassLive />} />}
          <Route path="year" element={<AdminYear />} />
          <Route path="feedback" element={<AdminFeedback />} />
        </Route>
      </Route>
      <Route path="teacher/:classId" element={<TeacherShell />}>
        <Route index element={<Today />} />
        <Route path="progress" element={<Suspense fallback={loading}><Progress /></Suspense>} />
        <Route path="students" element={<TeacherStudents />} />
        <Route path="students/:studentId" element={<StudentPage />} />
        <Route path="badges" element={<BadgeSheet />} />
        <Route path="add-pupils" element={<AddPupils />} />
        <Route path="maths" element={<TeacherMaths />}>
          <Route index element={<Suspense fallback={loading}><SetFocus /></Suspense>} />
          <Route path="skills" element={<Suspense fallback={loading}><SkillMap /></Suspense>} />
          <Route path="skips" element={<Suspense fallback={loading}><QuestionSkipsPanel /></Suspense>} />
          <Route path="hardest" element={<HardestQuestions />} />
          <Route path="foundational" element={<Suspense fallback={loading}><FoundationalSkills /></Suspense>} />
          <Route path="year78" element={<Suspense fallback={loading}><Year78Taught /></Suspense>} />
        </Route>
        <Route path="games" element={<TeacherGames />}>
          {/* A game's settings: a drawer over the table on a wide screen, its own page on a narrow one. */}
          <Route path=":gameId" element={null} />
        </Route>
        <Route path="quests" element={<TeacherQuests />} />
        <Route path="pulse" element={<Suspense fallback={loading}><TeacherPulse /></Suspense>} />
        {/* Class Showdown lives on the Class Live page (James, 24 Nov 2026: one page for both). */}
        {showdownOn() && <Route path="showdown" element={classliveOn() ? <Navigate to="../classlive?game=showdown" relative="path" replace /> : <Suspense fallback={loading}><TeacherShowdown /></Suspense>} />}
        {classliveOn() && <Route path="classlive" element={<Suspense fallback={loading}><TeacherClassLive /></Suspense>} />}
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
      <Route path="/badge/:code" element={<BadgeSignIn />} />
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
          {/* Chess and checkers, 101 and Power Clash with classmates are non-maths games: closed while the class has them off. */}
          <Route path="play/:id" element={<NonMathsGate><FriendGamePage /></NonMathsGate>} />
          <Route path="space-game/:id" element={<SpaceGamePage />} />
          <Route path="card-game/:id" element={<NonMathsGate><CardGamePage /></NonMathsGate>} />
          <Route path="power-game/:id" element={<NonMathsGate><PowerGamePage /></NonMathsGate>} />
          <Route path="leaderboard" element={<Leaderboard />} />
          {activitiesOn() && <Route path="activities" element={<Activities />} />}
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
          <Route path="achievements" element={<AchievementHall />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

/** Hands the class's "Skip button" switch to the question box (src/data/questionSkips.ts). */
function SkipRuleSync() {
  useSkipRuleSync();
  useQuestionFeedbackSync();
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
