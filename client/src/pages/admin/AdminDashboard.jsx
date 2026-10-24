import { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, Laptop, RefreshCw, Users, Zap } from 'lucide-react';
import { adminAPI, getErrorMessage } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import {
  AttendanceTrendChart,
  DonutChart,
  HorizontalBarChart,
  useChartColors,
} from '../../components/dashboard/AnalyticsCharts';
import { Alert, Button, Card, CardHeader, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { useDocumentTitle } from '../../hooks';

export function AdminDashboard() {
  useDocumentTitle('Admin overview');
  const chartColors = useChartColors();
  const { desks } = useSocket();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([adminAPI.getStats(), adminAPI.getAnalytics()]);
      setStats(statsRes.data);
      setAnalytics(analyticsRes.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load analytics.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // KPIs follow realtime desk changes (check-ins, locks) without a manual refresh.
  useEffect(() => {
    if (loading) return undefined;
    const id = setTimeout(() => adminAPI.getStats().then((res) => setStats(res.data)).catch(() => {}), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desks]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Live presence and attendance trends across your organization."
        actions={
          <Button variant="secondary" leftIcon={RefreshCw} loading={refreshing} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active now" value={stats?.currentlyWorking ?? 0} hint="Employees with a running session" icon={Zap} tone="success" loading={loading} />
        <StatCard label="In the office" value={stats?.officeWorking ?? 0} hint="Checked in at a desk" icon={Building2} loading={loading} />
        <StatCard label="Remote" value={stats?.remoteWorking ?? 0} hint="Working off-site" icon={Laptop} tone="neutral" loading={loading} />
        <StatCard label="Total employees" value={stats?.totalEmployees ?? 0} hint="Registered staff accounts" icon={Users} tone="dark" loading={loading} />
        <StatCard
          label="Free desks"
          value={stats?.availableDesks ?? 0}
          unit={stats ? `/ ${stats.totalDesks}` : undefined}
          hint={`${stats?.lockedDesks ?? 0} locked`}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard label="Hours today" value={stats?.totalHoursToday ?? '0.0'} unit="h" hint="Company-wide, including live sessions" icon={Clock} tone="warning" loading={loading} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Attendance trend"
            description="Daily sessions over the last 14 days"
            action={
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors.office }} /> Office
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors.remote }} /> Remote
                </span>
              </div>
            }
          />
          <div className="p-5">{loading ? <Skeleton className="h-72 w-full" /> : <AttendanceTrendChart data={analytics?.trendData} />}</div>
        </Card>

        <Card>
          <CardHeader title="Work mode split" description="Sessions in the last 30 days" />
          <div className="p-5">
            {loading ? (
              <Skeleton className="mx-auto h-48 w-48 rounded-full" />
            ) : (
              <DonutChart
                data={analytics?.modeBreakdown || []}
                colors={[chartColors.office, chartColors.remote]}
                emptyLabel="No sessions in the last 30 days"
              />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Headcount by department" description="Employees per department" />
        <div className="p-5">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : analytics?.departmentBreakdown?.length ? (
            <HorizontalBarChart data={analytics.departmentBreakdown} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No employees yet.</p>
          )}
        </div>
      </Card>
    </>
  );
}

export default AdminDashboard;
