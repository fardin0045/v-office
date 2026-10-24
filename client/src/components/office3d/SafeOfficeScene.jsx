import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Button, PageLoader } from '../ui';

const OfficeScene = lazy(() => import('./OfficeScene'));

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

function SceneUnavailable({ detail }) {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-canvas p-6">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-ink">The 3D office can’t load here</h2>
        <p className="mt-1 text-sm text-slate-500">
          {detail || 'Your browser or device doesn’t support WebGL, or hardware acceleration is turned off.'} You can still
          check in from your dashboard.
        </p>
        <Button as={Link} to="/dashboard" className="mt-6">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}

export function SafeOfficeScene(props) {
  const webgl = useMemo(() => supportsWebGL(), []);
  if (!webgl) return <SceneUnavailable />;
  return (
    <ErrorBoundary fallback={() => <SceneUnavailable detail="Something went wrong while rendering the 3D office." />}>
      <Suspense fallback={<PageLoader label="Loading the 3D office…" />}>
        <OfficeScene {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

