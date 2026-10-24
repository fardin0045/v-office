import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarCheck, CalendarX, ChevronLeft, ChevronRight, Clock, Download, Laptop, Percent, Printer, Timer,
} from 'lucide-react';
import { employeeAPI, getErrorMessage } from '../../services/api';
import { Alert, Avatar, Button, Card, PageHeader, Pill, Skeleton, StatCard } from '../../components/ui';
import { useDocumentTitle } from '../../hooks';
import { cn, formatDuration, formatTime, sessionPlace } from '../../lib/utils';

const pad = (n) => String(n).padStart(2, '0');
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};
const dayLabel = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    day: date.toLocaleDateString([], { day: '2-digit', month: 'short' }),
    weekday: date.toLocaleDateString([], { weekday: 'long' }),
  };
};

const STATUS = {
  present: { label: 'Present', tone: 'success' },
  working: { label: 'Working now', tone: 'success' },
  absent: { label: 'Absent', tone: 'danger' },
  weekend: { label: 'Weekend', tone: 'neutral' },
  'not-yet': { label: 'Not checked in yet', tone: 'warning' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  'not-joined': { label: 'Not joined yet', tone: 'neutral' },
};

const ROW_TONE = {
  absent: 'bg-rose-50/60',
  weekend: 'bg-slate-50/80',
  upcoming: 'text-slate-400',
  'not-joined': 'text-slate-400',
};

function downloadCsv(data) {
  const rows = [['Date', 'Day', 'Status', 'First check-in', 'Last check-out', 'Sessions', 'Hours', 'Place']];
  data.days.forEach((d) => {
    const { weekday } = dayLabel(d.date);
    rows.push([
      d.date,
      weekday,
      STATUS[d.status]?.label || d.status,
      d.firstIn ? formatTime(d.firstIn) : '',
      d.lastOut ? formatTime(d.lastOut) : d.status === 'working' ? 'In progress' : '',
      d.sessions.length,
      (d.totalSeconds / 3600).toFixed(2),
      d.sessions.map(sessionPlace).join(' | '),
    ]);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.employee.employeeId || 'employee'}-${data.month}-activity.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Compact month grid: one square per day, coloured by attendance.
function MonthStrip({ days, today }) {
  const firstWeekday = days.length ? (days[0].weekday + 6) % 7 : 0; // Monday-first
  const colour = {
    present: 'bg-emerald-500 text-snow dark:bg-emerald-200 dark:text-emerald-900',
    working: 'bg-emerald-500 text-snow ring-2 ring-emerald-200 dark:bg-emerald-200 dark:text-emerald-900 dark:ring-emerald-400',
    absent: 'bg-rose-500 text-snow dark:bg-rose-200 dark:text-rose-900',
    weekend: 'bg-slate-100 text-slate-400 dark:text-slate-500',
    'not-yet': 'bg-amber-100 text-amber-800',
    upcoming: 'bg-white text-slate-300 ring-1 ring-slate-200 dark:text-slate-500',
    'not-joined': 'bg-white text-slate-300 ring-1 ring-slate-200 dark:text-slate-500',
  };
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((d) => (
          <a
            key={d.date}
            href={`#day-${d.date}`}
            title={`${dayLabel(d.date).weekday}, ${dayLabel(d.date).day}: ${STATUS[d.status]?.label}${d.totalSeconds ? ` · ${formatDuration(d.totalSeconds)}` : ''}`}
            className={cn(
              'flex aspect-square items-center justify-center rounded-md text-xs font-semibold tabular-nums transition hover:opacity-80',
              colour[d.status],
              d.date === today && 'outline outline-2 outline-offset-1 outline-brand-500'
            )}
          >
            {Number(d.date.slice(8))}
          </a>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {[
          ['bg-emerald-500', 'Present'],
          ['bg-rose-500', 'Absent'],
          ['bg-slate-200', 'Weekend'],
          ['bg-white ring-1 ring-slate-300', 'Upcoming'],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm', c)} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

const minutesOfDay = (value) => {
  const d = new Date(value);
  return d.getHours() * 60 + d.getMinutes();
};
const clockLabel = (minutes) => {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), Math.round(minutes % 60), 0, 0);
  return formatTime(d);
};

// Month at a glance, next to the calendar.
function Highlights({ days, summary }) {
  if (!days || !summary) {
    return (
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  const worked = days.filter((d) => d.sessions.length);
  const longest = worked.reduce((best, d) => (!best || d.totalSeconds > best.totalSeconds ? d : best), null);
  const starts = worked.map((d) => minutesOfDay(d.firstIn));
  const avgStart = starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : null;
  const earliest = starts.length ? Math.min(...starts) : null;

  const items = [
    ['Office days', summary.officeDays, 'Checked in at a desk in the office'],
    ['Remote days', summary.remoteDays, 'Worked from anywhere'],
    ['Weekend days worked', summary.weekendDays, 'Saturday or Sunday sessions'],
    ['Longest day', longest ? formatDuration(longest.totalSeconds) : '—', longest ? `${dayLabel(longest.date).weekday}, ${dayLabel(longest.date).day}` : 'No sessions yet'],
    ['Usual start', avgStart === null ? '—' : clockLabel(avgStart), 'Average first check-in'],
    ['Earliest start', earliest === null ? '—' : clockLabel(earliest), 'First check-in of the month'],
  ];

  return (
    <div className="min-w-0">
      <p className="mb-3 text-sm font-semibold text-ink">Highlights</p>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{value}</dd>
            <dd className="truncate text-xs text-slate-400">{hint}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EmployeeMonthActivity() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const thisMonth = currentMonth();
  const requested = searchParams.get('month');
  const month = /^\d{4}-\d{2}$/.test(requested || '') && requested <= thisMonth ? requested : thisMonth;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useDocumentTitle(data ? `${data.employee.name} · ${monthLabel(month)}` : 'Monthly activity');

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    employeeAPI
      .getMonthActivity(id, month)
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Could not load this month’s activity.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, month]);

  useEffect(() => load(), [load]);

  const setMonth = (key) => {
    if (!key || key > thisMonth) return;
    setSearchParams(key === thisMonth ? {} : { month: key }, { replace: true });
  };

  const emp = data?.employee;
  const s = data?.summary;
  const showData = data && data.month === month;
  const rows = useMemo(() => (showData ? data.days : []), [showData, data]);

  return (
    <div>
      <Link to="/admin/employees" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink print:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to employees
      </Link>

      <PageHeader
        eyebrow="Monthly activity"
        title={
          emp ? (
            <span className="flex items-center gap-3">
              <Avatar person={emp} size="md" />
              <span className="min-w-0 truncate">{emp.name}</span>
            </span>
          ) : (
            'Employee activity'
          )
        }
        description={emp ? [emp.title, emp.department, emp.employeeId, emp.assignedDesk].filter(Boolean).join(' · ').replace(/-/g, '‑') /* keep IDs like DESK-03 on one line */ : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="month"
                value={month}
                max={thisMonth}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Month"
                className="h-8 w-[9.5rem] border-0 bg-transparent px-1 text-center text-sm font-semibold text-ink focus:outline-none focus:ring-0"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMonth(shiftMonth(month, 1))}
                disabled={month >= thisMonth}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="secondary" size="sm" leftIcon={Download} disabled={!showData} onClick={() => downloadCsv(data)}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" leftIcon={Printer} disabled={!showData} onClick={() => window.print()}>
              Print
            </Button>
          </div>
        }
      />

      {error && (
        <Alert tone="error" className="mb-6">
          {error}{' '}
          <button type="button" className="font-semibold underline" onClick={load}>
            Try again
          </button>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard
          label="Days present"
          value={s ? s.presentDays : '–'}
          unit={s ? `/ ${s.workingDays}` : undefined}
          hint={s?.weekendDays ? `Incl. ${s.weekendDays} weekend day${s.weekendDays > 1 ? 's' : ''}` : 'Working days so far'}
          icon={CalendarCheck}
          tone="success"
          loading={loading && !showData}
        />
        <StatCard label="Absent" value={s ? s.absentDays : '–'} unit="days" hint="Weekdays with no check-in" icon={CalendarX} tone="warning" loading={loading && !showData} />
        <StatCard label="Total time" value={s ? formatDuration(s.totalSeconds) : '–'} hint={monthLabel(month)} icon={Timer} loading={loading && !showData} />
        <StatCard label="Average day" value={s ? formatDuration(s.averageSeconds) : '–'} hint="On days present" icon={Clock} tone="neutral" loading={loading && !showData} />
        <StatCard
          label="Attendance"
          value={s ? (s.attendanceRate === null ? '—' : s.attendanceRate) : '–'}
          unit={s && s.attendanceRate !== null ? '%' : undefined}
          hint={s ? `${s.officeDays} office · ${s.remoteDays} remote days` : undefined}
          icon={Percent}
          tone="dark"
          loading={loading && !showData}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card className="mb-6 grid gap-6 p-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-8 print:hidden">
        <div>
          <p className="mb-3 text-sm font-semibold text-ink">{monthLabel(month)}</p>
          {showData ? <MonthStrip days={data.days} today={data.today} /> : <Skeleton className="h-64 w-full" />}
        </div>
        <Highlights days={showData ? rows : null} summary={s} />
      </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Check in</th>
                  <th className="px-5 py-3 font-semibold">Check out</th>
                  <th className="px-5 py-3 font-semibold">Sessions</th>
                  <th className="px-5 py-3 text-right font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!showData
                  ? Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-5 py-3">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map((d) => {
                      const { day, weekday } = dayLabel(d.date);
                      const meta = STATUS[d.status] || STATUS.absent;
                      const isToday = d.date === data.today;
                      return (
                        <tr key={d.date} id={`day-${d.date}`} className={cn('scroll-mt-24 align-top', ROW_TONE[d.status], isToday && 'bg-brand-50/60')}>
                          <td className="whitespace-nowrap px-5 py-3">
                            <p className="font-semibold tabular-nums text-ink">
                              {day}
                              {isToday && <span className="ml-2 text-xs font-semibold text-brand-700">Today</span>}
                            </p>
                            <p className="text-xs text-slate-500">{weekday}</p>
                          </td>
                          <td className="px-5 py-3">
                            <Pill tone={meta.tone}>
                              {d.status === 'working' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
                              {meta.label}
                            </Pill>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700">{d.firstIn ? formatTime(d.firstIn) : '—'}</td>
                          <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700">
                            {d.status === 'working' ? <span className="text-emerald-700">In progress</span> : d.lastOut ? formatTime(d.lastOut) : '—'}
                          </td>
                          <td className="px-5 py-3">
                            {d.sessions.length === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <ul className="space-y-1">
                                {d.sessions.map((session) => (
                                  <li key={session._id} className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                                    <span className="tabular-nums">
                                      {formatTime(session.checkIn)} – {session.status === 'working' ? 'now' : formatTime(session.checkOut)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                                      {session.mode === 'remote' && <Laptop className="h-3 w-3" aria-hidden="true" />}
                                      {sessionPlace(session)}
                                    </span>
                                    {String(session.endReason || '').startsWith('auto') && <span className="text-slate-400">auto check-out</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-ink">
                            {d.totalSeconds ? formatDuration(d.totalSeconds) : <span className="font-normal text-slate-400">—</span>}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
              {showData && (
                <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 font-semibold text-ink">
                      {s.presentDays} day{s.presentDays === 1 ? '' : 's'} present · {s.absentDays} absent
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-ink">{formatDuration(s.totalSeconds)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
    </div>
  );
}

export default EmployeeMonthActivity;
