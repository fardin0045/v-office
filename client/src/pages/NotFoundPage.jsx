import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../components/ui';
import { useDocumentTitle } from '../hooks';

export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-slate-500">The link may be broken or the page may have moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button as={Link} to="/" leftIcon={ArrowLeft}>
            Back to home
          </Button>
          <Button as={Link} to="/office" variant="secondary">
            Open virtual office
          </Button>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
