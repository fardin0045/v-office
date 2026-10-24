import { Spinner } from '../ui/Spinner';
import { LogoMark } from './Logo';

export function LoadingScreen({ message = 'Loading your workspace…' }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-canvas" role="status" aria-live="polite">
      <LogoMark className="h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" />
      <div className="flex items-center gap-2.5 text-sm font-medium text-slate-500">
        <Spinner className="h-4 w-4 text-brand-600" />
        {message}
      </div>
    </div>
  );
}

export default LoadingScreen;
