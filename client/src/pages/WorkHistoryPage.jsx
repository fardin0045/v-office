import { useEffect, useState } from 'react';
import { History, RotateCcw, Search } from 'lucide-react';
import { useWorkSession } from '../context/WorkSessionContext';
import { workAPI, getErrorMessage } from '../services/api';
import { SessionTable } from '../components/dashboard/SessionTable';
import { Alert, Button, Card, EmptyState, Input, PageContainer, PageHeader, Pagination, Select } from '../components/ui';
import { useDebouncedValue, useDocumentTitle } from '../hooks';

const PAGE_SIZE = 10;
const INITIAL_FILTERS = { q: '', mode: '', startDate: '', endDate: '' };

export function WorkHistoryPage() {
  useDocumentTitle('Work history');
  const { revision } = useWorkSession();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ sessions: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = useDebouncedValue(filters.q.trim());
  const { mode, startDate, endDate } = filters;
  const hasFilters = Boolean(filters.q || mode || startDate || endDate);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = { page, limit: PAGE_SIZE };
    if (q) params.q = q;
    if (mode) params.mode = mode;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    workAPI
      .getHistory(params)
      .then((res) => {
        if (cancelled) return;
        setResult(res.data);
        setError('');
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Could not load your history.')))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, q, mode, startDate, endDate, revision]);

  const updateFilter = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    setPage(1);
  };

  const reset = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Timesheets"
        title="Work history"
        description="Every office and remote session you’ve logged, with check-in times and durations."
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <Input
            label="Search"
            icon={Search}
            type="search"
            placeholder="Desk or date (e.g. DESK-12, 2026-09)"
            value={filters.q}
            onChange={updateFilter('q')}
          />
          <Select label="Work mode" value={mode} onChange={updateFilter('mode')}>
            <option value="">All modes</option>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
          </Select>
          <Input label="From" type="date" value={startDate} max={endDate || undefined} onChange={updateFilter('startDate')} />
          <Input label="To" type="date" value={endDate} min={startDate || undefined} onChange={updateFilter('endDate')} />
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
          skeletonRows={PAGE_SIZE}
          empty={
            <EmptyState
              icon={History}
              title={hasFilters ? 'No sessions match your filters' : 'No sessions yet'}
              description={
                hasFilters ? 'Try a different date range or search term.' : 'Once you check in, your sessions will appear here.'
              }
              action={
                hasFilters && (
                  <Button variant="secondary" onClick={reset}>
                    Clear filters
                  </Button>
                )
              }
            />
          }
        />
        {!loading && (
          <Pagination page={result.page || page} pages={result.pages} total={result.total} onChange={setPage} label="sessions" />
        )}
      </Card>
    </PageContainer>
  );
}

export default WorkHistoryPage;
