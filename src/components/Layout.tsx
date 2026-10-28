import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { themeOf } from '../avatar/avatarParts';
import { WaitingCount, WaitingToJoinProvider } from '../teacher/WaitingToJoin';
import { pageTheme, ThemeTrialProvider, useThemeTrial } from '../theme/hubTheme';
import { trainingOn } from '../training/switch';
import { CrashScreen } from './CrashScreen';
import { MuteButton } from './MuteButton';
import banner from '../assets/dps-banner.png';

const NAV = [
  { to: '/', label: 'Home', emoji: '🏠' },
  { to: '/lobby', label: 'Lobby', emoji: '🤝' },
  { to: '/leaderboard', label: 'Leaderboard', emoji: '🏅' },
];

export function Layout() {
  const { profile } = useAuth();
  return (
    <ThemeTrialProvider>
      <WaitingToJoinProvider teacher={profile?.role === 'teacher'}>
        <ThemedLayout />
      </WaitingToJoinProvider>
    </ThemeTrialProvider>
  );
}

function ThemedLayout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const { trial } = useThemeTrial();
  const theme = pageTheme(pathname, trial ?? themeOf(profile?.avatar));
  return (
    <div className="hub-page" data-hub-theme={theme}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="brand__banner" src={banner} alt="Douglas Park School" width={412} height={77} />
          <span className="brand__name">Games Hub</span>
        </NavLink>
        <nav aria-label="Main" className="topnav">
          {[
            ...NAV,
            ...(trainingOn() ? [{ to: '/training', label: 'Training', emoji: '🧮' }] : []),
            ...(profile?.role === 'teacher' ? [{ to: '/teacher', label: 'Teacher', emoji: '🧑‍🏫' }] : []),
          ].map((item) => (
            // The Teacher link stays lit on every teacher page (/teacher/:classId/…).
            <NavLink key={item.to} to={item.to} end={item.to !== '/teacher'} className="topnav__link">
              <span aria-hidden="true">{item.emoji}</span> {item.label}
              {item.to === '/teacher' && <WaitingCount />}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__right">
          <MuteButton />
          <NavLink to="/profile" className="topbar__profile" aria-label="My profile">
            <AvatarImage avatar={profile?.avatar} size={44} />
          </NavLink>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {/* A new page starts with a clean slate, so one broken page doesn't stay broken after you leave it. */}
        <CrashScreen key={pathname}>
          <Outlet />
        </CrashScreen>
      </main>
    </div>
  );
}
