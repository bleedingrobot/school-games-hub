import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { trainingOn } from '../training/switch';
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
    <>
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
            <NavLink key={item.to} to={item.to} end className="topnav__link">
              <span aria-hidden="true">{item.emoji}</span> {item.label}
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
        <Outlet />
      </main>
    </>
  );
}
