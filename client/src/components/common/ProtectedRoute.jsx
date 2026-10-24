import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from './LoadingScreen';

export function ProtectedRoute({ children, adminOnly = false }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen message="Verifying your session…" />;

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}

// Only same-app paths are allowed as redirect targets (prevents open redirects like //evil.com).
export function safeReturnUrl(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

// Signed-in users have no reason to see the login / register screens; send them where they were headed.
export function GuestRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen message="Verifying your session…" />;
  if (isAuthenticated) {
    const returnUrl = new URLSearchParams(location.search).get('returnUrl');
    return <Navigate to={safeReturnUrl(returnUrl)} replace />;
  }
  return children;
}

export default ProtectedRoute;
