import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { EmptyState } from '../ui';
import { useTheme } from '../../lib/theme';

// Recharts draws SVG attributes, which can't read CSS variables, so each theme has its own palette.
const PALETTES = {
  light: {
    office: '#2dd9d6', // brand-400
    officeLine: '#14bcb9',
    remote: '#135f5e', // brand-800
    grid: '#e2e8f0',
    axis: '#94a3b8',
    label: '#475569',
    surface: '#ffffff',
    text: '#0f172a',
    shadow: 'rgba(15, 23, 42, 0.15)',
    palette: ['#2dd9d6', '#135f5e', '#53ece9', '#0e9895', '#94a3b8', '#b0f7f5'],
  },
  dark: {
    office: '#2dd9d6',
    officeLine: '#53ece9',
    remote: '#b0f7f5',
    grid: '#2a3744',
    axis: '#7a8a9a',
    label: '#adbac7',
    surface: '#111921',
    text: '#e8eef3',
    shadow: 'rgba(0, 0, 0, 0.5)',
    palette: ['#2dd9d6', '#b0f7f5', '#53ece9', '#0e9895', '#7a8a9a', '#135f5e'],
  },
};

export function useChartColors() {
  return PALETTES[useTheme().theme];
}

function useChartTheme() {
  const colors = useChartColors();
  return {
    colors,
    axisProps: { stroke: colors.axis, fontSize: 12, tickLine: false, axisLine: false },
    tooltipProps: {
      cursor: { fill: 'rgba(83, 236, 233, 0.12)' },
      contentStyle: {
        background: colors.surface,
        border: `1px solid ${colors.grid}`,
        borderRadius: 10,
        boxShadow: `0 8px 24px -6px ${colors.shadow}`,
        fontSize: 12,
        color: colors.text,
        padding: '8px 12px',
      },
      labelStyle: { fontWeight: 600, marginBottom: 4, color: colors.text },
      itemStyle: { color: colors.text },
    },
  };
}

export function WeeklyHoursChart({ data = [] }) {
  const { colors, axisProps, tooltipProps } = useChartTheme();
  return (
    <div className="h-64 w-full" role="img" aria-label="Bar chart of hours worked per day over the last 7 days">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} unit="h" allowDecimals={false} />
          <Tooltip {...tooltipProps} formatter={(value) => [`${value} h`, 'Worked']} />
          <Bar dataKey="hours" fill={colors.office} radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data = [], colors: colorsProp, emptyLabel = 'No data yet' }) {
  const { colors: theme, tooltipProps } = useChartTheme();
  const colors = colorsProp || theme.palette;
  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);

  if (total === 0) {
    return <EmptyState icon={PieIcon} title={emptyLabel} description="Data will appear once sessions are logged." />;
  }

  return (
    <div>
      <div className="relative h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={56} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipProps} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-ink tabular-nums">{total}</span>
          <span className="text-xs text-slate-500">sessions</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              {entry.name}
            </span>
            <span className="font-semibold text-ink tabular-nums">
              {entry.value} <span className="font-normal text-slate-400">({Math.round((entry.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkModeDonutChart({ officeCount = 0, remoteCount = 0 }) {
  const colors = useChartColors();
  return (
    <DonutChart
      data={[
        { name: 'Office', value: officeCount },
        { name: 'Remote', value: remoteCount },
      ]}
      colors={[colors.office, colors.remote]}
      emptyLabel="No sessions in the last 30 days"
    />
  );
}

export function AttendanceTrendChart({ data = [] }) {
  const { colors, axisProps, tooltipProps } = useChartTheme();
  return (
    <div className="h-72 w-full" role="img" aria-label="Area chart of daily office and remote attendance">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="officeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.office} stopOpacity={0.45} />
              <stop offset="100%" stopColor={colors.office} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="remoteFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.remote} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.remote} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tooltipProps} cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="office" name="Office" stroke={colors.officeLine} strokeWidth={2} fill="url(#officeFill)" />
          <Area type="monotone" dataKey="remote" name="Remote" stroke={colors.remote} strokeWidth={2} fill="url(#remoteFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalBarChart({ data = [], valueLabel = 'Employees' }) {
  const { colors, axisProps, tooltipProps } = useChartTheme();
  const height = Math.max(160, data.length * 40);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={`Bar chart of ${valueLabel.toLowerCase()} by category`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
          <XAxis type="number" {...axisProps} allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...axisProps} width={150} tick={{ fill: colors.label, fontSize: 12 }} />
          <Tooltip {...tooltipProps} formatter={(value) => [value, valueLabel]} />
          <Bar dataKey="value" fill={colors.office} radius={[0, 6, 6, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
