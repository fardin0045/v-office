import { useEffect, useState } from 'react';
import { ClipboardList, RotateCcw, Search } from 'lucide-react';
import { adminAPI, getErrorMessage } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { SessionTable } from '../../components/dashboard/SessionTable';
import { Alert, Button, Card, EmptyState, Input, PageHeader, Pagination, Select } from '../../components/ui';
import { useDebouncedValue, useDocumentTitle } from '../../hooks';

const PAGE_SIZE = 15;
const INITIAL = { q: '', mode: '', startDate: '', endDate: '' };

export function WorkSessionLog() {
  useDocumentTitle('Attendance log');
  const { notifications } = useSocket();
  const [filters, setFilters] = useState(INITIAL);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ sessions: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = useDebouncedValue(filters.q.trim());
  const { mode, startDate, endDate } = filters;
  const hasFilters = Boolean(filters.q || mode || startDate || endDate);
  // Refetch when someone checks in/out so the log stays current.
  const latestEvent = notifications[0]?.id;

  useEffect(() => {
    let cancelled = false;

    const params = { page, limit: PAGE_SIZE };
    if (q) params.q = q;
    if (mode) params.mode = mode;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    adminAPI
      .getSessions(params)
      .then((res) => {
        if (cancelled) return;
        setResult(res.data);
        setError('');
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Could not load sessions.')))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, q, mode, startDate, endDate, latestEvent]);

  const update = (key) => (event) => {
    setFilters((f) => ({ ...f, [key]: event.target.value }));
    setPage(1);
    setLoading(true);
  };

  const reset = () => {
    setFilters(INITIAL);
    setPage(1);
    setLoading(true);
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="Attendance log" description="Every check-in across the company, office and remote." />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <Input label="Search" icon={Search} type="search" placeholder="Employee name, ID or desk" value={filters.q} onChange={update('q')} />
          <Select label="Work mode" value={mode} onChange={update('mode')}>
            <option value="">All modes</option>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
          </Select>
          <Input label="From" type="date" value={startDate} max={endDate || undefined} onChange={update('startDate')} />
          <Input label="To" type="date" value={endDate} min={startDate || undefined} onChange={update('endDate')} />
          <Button variant="ghost" leftIcon={RotateCcw} onClick={reset} disabled={!hasFilters}>
            Reset
          </Button>
        </div>
      </Card>

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <SessionTable
          sessions={result.sessions}
          loading={loading}
          showEmployee
          skeletonRows={8}
          empty={
            <EmptyState
              icon={ClipboardList}
              title={hasFilters ? 'No sessions match your filters' : 'No sessions recorded yet'}
              description={hasFilters ? 'Try a different search or date range.' : 'Check-ins will appear here as they happen.'}
            />
          }
        />
        {!loading && <Pagination page={result.page || page} pages={result.pages} total={result.total} onChange={setPage} label="sessions" />}
      </Card>
    </>
  );
}

export default WorkSessionLog;
