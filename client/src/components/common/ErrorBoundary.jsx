import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * Catches render errors so one broken widget can't blank the whole app.
 * `resetKey` (e.g. the current path) clears the error when the user navigates away.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ error: this.state.error, reset: () => this.setState({ error: null }) });

    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
          <p className="mt-1 text-sm text-slate-500">
            An unexpected error occurred while showing this page. Reloading usually fixes it.
          </p>
          <Button className="mt-6" leftIcon={RotateCcw} onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
