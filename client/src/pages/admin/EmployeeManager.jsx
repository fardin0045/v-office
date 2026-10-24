import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Eye, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { deskAPI, employeeAPI, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pill,
  Select,
  Skeleton,
  StatusBadge,
  useConfirm,
  useToast,
} from '../../components/ui';
import { useDocumentTitle } from '../../hooks';
import { formatDateKey, formatDuration, sessionPlace } from '../../lib/utils';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  employeeId: '',
  role: 'employee',
  department: '',
  title: '',
  assignedDesk: '',
  workMode: 'office',
};

function nextEmployeeId(employees) {
  const max = employees.reduce((acc, e) => {
    const n = Number(String(e.employeeId).match(/(\d+)$/)?.[1]);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `EMP-${String(max + 1).padStart(3, '0')}`;
}

function EmployeeFormModal({ mode, initial, desks, employees, onClose, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isCreate = mode === 'create';
  const isSelf = !isCreate && initial._id === user?._id;

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  // Show who currently holds each desk so reassignments are a conscious choice.
  const deskOwner = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => e.assignedDesk && map.set(e.assignedDesk, e));
    return map;
  }, [employees]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (isCreate && form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await employeeAPI.create(form);
        toast.success(`${form.name} was added`);
      } else {
        const { password: _unused, employeeId: _id, _id: _mongoId, ...changes } = form;
        await employeeAPI.update(initial._id, changes);
        toast.success(`${form.name} was updated`);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save employee.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isCreate ? 'Add employee' : `Edit ${initial.name}`}
      description={isCreate ? 'Create an account and optionally assign a desk.' : 'Update details, role or desk assignment.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" loading={saving}>
            {isCreate ? 'Create employee' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={form.name} onChange={set('name')} />
          <Input
            label="Employee ID"
            required
            disabled={!isCreate}
            value={form.employeeId}
            onChange={set('employeeId')}
            inputClassName="font-mono uppercase"
            hint={!isCreate ? 'IDs cannot be changed' : undefined}
          />
        </div>
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
        {isCreate && (
          <Input
            label="Temporary password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            hint="At least 8 characters. Share it securely; the employee can change it from their profile."
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Department" value={form.department} onChange={set('department')} placeholder="Engineering" />
          <Input label="Job title" value={form.title} onChange={set('title')} placeholder="Software Engineer" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Role" value={form.role} onChange={set('role')} disabled={isSelf} hint={isSelf ? 'You can’t change your own role' : undefined}>
            <option value="employee">Employee</option>
            <option value="admin">Administrator</option>
          </Select>
          <Select label="Work mode" value={form.workMode} onChange={set('workMode')}>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
          </Select>
          <Select label="Workstation" value={form.assignedDesk} onChange={set('assignedDesk')} selectClassName="font-mono">
            <option value="">Unassigned</option>
            {desks.map((d) => {
              const owner = deskOwner.get(d.deskId);
              const takenByOther = owner && owner._id !== initial._id;
              return (
                <option key={d.deskId} value={d.deskId}>
                  {d.deskId}
                  {takenByOther ? ` · ${owner.name}` : ''}
                </option>
              );
            })}
          </Select>
        </div>
        {form.assignedDesk && deskOwner.get(form.assignedDesk) && deskOwner.get(form.assignedDesk)._id !== initial._id && (
          <Alert tone="warning">
            {form.assignedDesk} is currently assigned to {deskOwner.get(form.assignedDesk).name}. Saving will move it.
          </Alert>
        )}
      </form>
    </Modal>
  );
}

function EmployeeDetailsModal({ employeeId, onClose }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    employeeAPI
      .getById(employeeId)
      .then((res) => !cancelled && setDetails(res.data))
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const emp = details?.employee;

  return (
    <Modal
      open
      onClose={onClose}
      title="Employee details"
      size="md"
      footer={
        <Button as={Link} to={`/admin/employees/${employeeId}/activity`} leftIcon={CalendarDays} className="w-full sm:w-auto">
          View full month activity
        </Button>
      }
    >
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !details ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar person={emp} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{emp.name}</p>
              <p className="truncate text-sm text-slate-500">{emp.title} · {emp.department}</p>
              <p className="truncate text-xs text-slate-400">{emp.email}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['Total hours', `${details.totalHours} h`],
              ['Sessions', details.totalSessions],
              ['Desk', emp.assignedDesk || 'Unassigned'],
              ['Status', details.isWorking ? 'Working now' : 'Offline'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Recent sessions</p>
            {details.recentSessions.length === 0 ? (
              <p className="text-sm text-slate-500">No sessions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {details.recentSessions.slice(0, 5).map((s) => (
                  <li key={s._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-slate-600">{formatDateKey(s.date)}</span>
                    <span className="font-mono text-xs text-slate-500">{sessionPlace(s)}</span>
                    <span className="font-medium tabular-nums text-ink">
                      {s.status === 'working' ? 'In progress' : formatDuration(s.duration)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function EmployeeManager() {
  useDocumentTitle('Employees');
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [employees, setEmployees] = useState([]);
  const [desks, setDesks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null); // { mode, initial }
  const [detailsId, setDetailsId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [empRes, deskRes] = await Promise.all([employeeAPI.getAll(), deskAPI.getAllDesks()]);
      setEmployees(empRes.data);
      setDesks(deskRes.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load employees.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) =>
      [e.name, e.email, e.employeeId, e.department, e.title, e.assignedDesk].some((v) => v?.toLowerCase().includes(term))
    );
  }, [employees, search]);

  const openCreate = () =>
    setEditor({ mode: 'create', initial: { ...EMPTY_FORM, employeeId: nextEmployeeId(employees) } });

  const openEdit = (emp) =>
    setEditor({
      mode: 'edit',
      initial: {
        ...EMPTY_FORM,
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        employeeId: emp.employeeId,
        role: emp.role,
        department: emp.department || '',
        title: emp.title || '',
        assignedDesk: emp.assignedDesk || '',
        workMode: emp.workMode || 'office',
      },
    });

  const remove = async (emp) => {
    const ok = await confirm({
      title: `Remove ${emp.name}?`,
      message: `This permanently deletes their account${emp.assignedDesk ? ` and frees ${emp.assignedDesk}` : ''}. Their past sessions stay in the attendance log.`,
      confirmLabel: 'Remove employee',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await employeeAPI.delete(emp._id);
      toast.success(`${emp.name} was removed`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove employee.'));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Employees"
        description={`${employees.length} people · manage accounts, roles and desk assignments.`}
        actions={
          <Button leftIcon={UserPlus} onClick={openCreate}>
            Add employee
          </Button>
        }
      />

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <Input
            icon={Search}
            type="search"
            placeholder="Search by name, email, ID, department or desk"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
            aria-label="Search employees"
          />
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No employees match your search' : 'No employees yet'}
            description={search ? 'Try a different name, ID or department.' : 'Add your first employee to get started.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Role & department</th>
                  <th className="px-5 py-3 font-semibold">Desk</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => (
                  <tr key={emp._id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar person={emp} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {emp.name}
                            {emp._id === user?._id && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            <span className="font-mono">{emp.employeeId}</span> · {emp.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-700">{emp.title}</p>
                      <p className="text-xs text-slate-500">
                        {emp.department}
                        {emp.role === 'admin' && (
                          <Pill tone="dark" className="ml-2 align-middle">
                            Admin
                          </Pill>
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      {emp.assignedDesk ? (
                        <Pill tone="brand" className="font-mono">
                          {emp.assignedDesk}
                        </Pill>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {emp.isWorking ? (
                        <StatusBadge status="working" />
                      ) : (
                        <Pill tone="neutral">Offline</Pill>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDetailsId(emp._id)} aria-label={`View ${emp.name}`} title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(emp)} aria-label={`Edit ${emp.name}`} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="icon-sm"
                          onClick={() => remove(emp)}
                          disabled={emp._id === user?._id}
                          aria-label={`Remove ${emp.name}`}
                          title={emp._id === user?._id ? 'You can’t remove yourself' : 'Remove'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editor && (
        <EmployeeFormModal
          mode={editor.mode}
          initial={editor.initial}
          desks={desks}
          employees={employees}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      )}
      {detailsId && <EmployeeDetailsModal employeeId={detailsId} onClose={() => setDetailsId(null)} />}
    </>
  );
}

export default EmployeeManager;
