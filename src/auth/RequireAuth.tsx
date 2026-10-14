import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';

/** Only signed-in school users get past here. Everyone else goes to the sign-in screen. */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <div className="loading" role="status">
        <span className="loading__dice" aria-hidden="true">
          🎲
        </span>
        Loading…
      </div>
    );
  }
  if (status === 'signed-out') return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}
