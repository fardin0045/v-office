import { useEffect, useMemo, useState } from 'react';
import { Grid3x3, Lock, Unlock, UserPlus, UserX } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { deskAPI, employeeAPI, getErrorMessage } from '../../services/api';
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  useConfirm,
  useToast,
} from '../../components/ui';
import { useDocumentTitle } from '../../hooks';
import { cn } from '../../lib/utils';

const ZONES = [
  { id: '', label: 'All zones' },
  { id: 'ZONE_A', label: 'Front office' },
  { id: 'ZONE_B', label: 'Lounge' },
  { id: 'ZONE_C', label: 'Pods' },
  { id: 'ZONE_D', label: 'CEO suite' },
  { id: 'ZONE_E', label: 'Engineering' },
];

const deskState = (desk) => (desk.locked ? 'locked' : desk.status === 'working' ? 'working' : 'available');

function AssignModal({ desk, onClose }) {
  const toast = useToast();
  const [employees, setEmployees] = useState(null);
  const [selected, setSelected] = useState(desk.employeeId?._id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    employeeAPI
      .getAll()
      .then((res) => !cancelled && setEmployees(res.data))
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Could not load employees.')));
    return () => {
      cancelled = true;
    };
  }, []);

  const current = employees?.find((e) => e._id === selected);

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await deskAPI.assignDesk({ deskId: desk.deskId, employeeId: selected });
      toast.success(`${desk.deskId} assigned to ${current?.name || 'employee'}`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not assign desk.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign ${desk.deskId}`}
      description={desk.zoneName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-form" loading={saving} disabled={!selected || !employees}>
            Assign desk
          </Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {!employees && !error ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select label="Employee" required value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose an employee…</option>
            {(employees || []).map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name} ({emp.employeeId}){emp.assignedDesk ? ` — currently ${emp.assignedDesk}` : ''}
              </option>
            ))}
          </Select>
        )}
        {current?.assignedDesk && current.assignedDesk !== desk.deskId && (
          <Alert tone="warning">
            {current.name} will be moved from {current.assignedDesk}, which will become unassigned.
          </Alert>
        )}
      </form>
    </Modal>
  );
}

export function DeskManager() {
  useDocumentTitle('Workstations');
  const { desks, desksLoaded } = useSocket();
  const toast = useToast();
  const confirm = useConfirm();
  const [zone, setZone] = useState('');
  const [assigning, setAssigning] = useState(null);
  const [pending, setPending] = useState(null);

  const filtered = useMemo(() => (zone ? desks.filter((d) => d.zone === zone) : desks), [desks, zone]);
  const counts = useMemo(
    () =>
      desks.reduce(
        (acc, d) => {
          acc[deskState(d)] += 1;
          if (!d.employeeId) acc.unassigned += 1;
          return acc;
        },
        { available: 0, working: 0, locked: 0, unassigned: 0 }
      ),
    [desks]
  );

  const withPending = async (key, fn) => {
    setPending(key);
    try {
      await fn();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const toggleLock = (desk) =>
    withPending(`lock-${desk.deskId}`, async () => {
      await deskAPI.toggleLock({ deskId: desk.deskId, locked: !desk.locked });
      toast.success(`${desk.deskId} ${desk.locked ? 'unlocked' : 'locked'}`);
    });

  const unassign = async (desk) => {
    const name = desk.employeeId?.name || desk.assignedEmployeeName || 'The assignee';
    const ok = await confirm({
      title: `Unassign ${desk.deskId}?`,
      message:
        desk.status === 'working'
          ? `${name} is checked in here right now. Their session will be ended and the desk freed.`
          : `${name} will no longer be able to check in at this desk.`,
      confirmLabel: 'Unassign',
      tone: 'danger',
    });
    if (!ok) return;
    withPending(`unassign-${desk.deskId}`, async () => {
      await deskAPI.unassignDesk({ deskId: desk.deskId });
      toast.success(`${desk.deskId} is now unassigned`);
    });
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="Workstations" description="Assign desks, lock seats and see live occupancy. Updates in real time." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Available', counts.available, 'text-brand-800'],
          ['Working', counts.working, 'text-emerald-700'],
          ['Locked', counts.locked, 'text-slate-600'],
          ['Unassigned', counts.unassigned, 'text-amber-700'],
        ].map(([label, value, color]) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{desksLoaded ? value : '–'}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by zone">
        {ZONES.map((z) => (
          <button
            key={z.id}
            type="button"
            role="tab"
            aria-selected={zone === z.id}
            onClick={() => setZone(z.id)}
            className={cn(
              'h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors',
              zone === z.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            )}
          >
            {z.label}
          </button>
        ))}
      </div>

      {!desksLoaded ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Grid3x3} title="No workstations in this zone" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((desk) => {
            const state = deskState(desk);
            const emp = desk.employeeId;
            return (
              <Card
                key={desk.deskId}
                className={cn(
                  'flex flex-col p-4 transition-shadow hover:shadow-card-hover',
                  state === 'working' && 'border-emerald-200',
                  state === 'locked' && 'bg-slate-50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-base font-bold text-ink">{desk.deskId}</p>
                    <p className="text-xs text-slate-500">{desk.zoneName}</p>
                  </div>
                  <StatusBadge status={state} />
                </div>

                <div className="mt-4 flex min-h-[44px] items-center gap-3">
                  {emp ? (
                    <>
                      <Avatar person={emp} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{emp.name}</p>
                        <p className="truncate text-xs text-slate-500">{emp.title}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No one assigned</p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                  <Button variant="secondary" size="sm" leftIcon={UserPlus} onClick={() => setAssigning(desk)} className="flex-1">
                    {emp ? 'Reassign' : 'Assign'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleLock(desk)}
                    loading={pending === `lock-${desk.deskId}`}
                    aria-label={desk.locked ? `Unlock ${desk.deskId}` : `Lock ${desk.deskId}`}
                    title={desk.locked ? 'Unlock desk' : 'Lock desk'}
                  >
                    {pending !== `lock-${desk.deskId}` && (desk.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />)}
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="icon-sm"
                    onClick={() => unassign(desk)}
                    disabled={!emp}
                    loading={pending === `unassign-${desk.deskId}`}
                    aria-label={`Unassign ${desk.deskId}`}
                    title="Unassign desk"
                  >
                    {pending !== `unassign-${desk.deskId}` && <UserX className="h-4 w-4" />}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {assigning && <AssignModal desk={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
}

export default DeskManager;
