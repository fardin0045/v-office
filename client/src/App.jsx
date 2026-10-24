import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { WorkSessionProvider } from './context/WorkSessionContext';
import { MeetingsProvider } from './context/MeetingsContext';
import { ChatProvider } from './context/ChatContext';
import { FeedbackProvider, PageLoader } from './components/ui';
import { Navbar } from './components/common/Navbar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { GuestRoute, ProtectedRoute } from './components/common/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';

// Route-level code splitting: the 3D engine and chart libraries only download on the pages that use them.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VirtualOfficePage = lazy(() => import('./pages/VirtualOfficePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const WorkHistoryPage = lazy(() => import('./pages/WorkHistoryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-pop"
      >
        Skip to content
      </a>
      <Navbar />
      <div id="content" className="flex flex-1 flex-col">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <LoginPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <RegisterPage />
                  </GuestRoute>
                }
              />
              <Route path="/office" element={<VirtualOfficePage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <WorkHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <FeedbackProvider>
        <AuthProvider>
          <SocketProvider>
            <WorkSessionProvider>
              <MeetingsProvider>
                <ChatProvider>
                  <AppRoutes />
                </ChatProvider>
              </MeetingsProvider>
            </WorkSessionProvider>
          </SocketProvider>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}

export default App;
