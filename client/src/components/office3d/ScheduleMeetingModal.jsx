import { useMemo, useState } from 'react';
import { CalendarPlus, Link as LinkIcon } from 'lucide-react';
import { useMeetings } from '../../context/MeetingsContext';
import { getErrorMessage } from '../../services/api';
import { isHttpUrl } from '../../lib/utils';
import { Alert, Button, Input, Modal, Select, useToast } from '../ui';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const pad = (n) => String(n).padStart(2, '0');

// <input type="datetime-local"> works in local time without a timezone suffix.
const toLocalInput = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

export function ScheduleMeetingModal({ meeting, onClose }) {
  const { create, update } = useMeetings();
  const toast = useToast();
  const editing = Boolean(meeting);

  const initial = useMemo(() => {
    if (!meeting) return { title: '', description: '', startsAt: toLocalInput(nextHalfHour()), duration: '30', link: '' };
    const minutes = Math.round((new Date(meeting.endsAt) - new Date(meeting.startsAt)) / 60000);
    return {
      title: meeting.title,
      description: meeting.description || '',
      startsAt: toLocalInput(new Date(meeting.startsAt)),
      duration: String(minutes),
      link: meeting.link || '',
    };
  }, [meeting]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const durationOptions = DURATIONS.includes(Number(form.duration)) ? DURATIONS : [...DURATIONS, Number(form.duration)].sort((a, b) => a - b);

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (form.title.trim().length < 3) found.title = 'Enter a title (at least 3 characters)';
    const start = new Date(form.startsAt);
    if (!form.startsAt || Number.isNaN(start.getTime())) found.startsAt = 'Choose a start time';
    else if (!editing && start.getTime() < Date.now() - 5 * 60000) found.startsAt = 'The start time is in the past';
    if (form.link.trim() && !isHttpUrl(form.link.trim())) found.link = 'Enter a full link starting with https://';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setServerError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: start.toISOString(),
      durationMinutes: Number(form.duration),
      link: form.link.trim(),
    };
    try {
      if (editing) {
        await update(meeting._id, payload);
        toast.success('Meeting updated');
      } else {
        await create(payload);
        toast.success(`“${payload.title}” scheduled. Everyone has been notified.`);
      }
      onClose();
    } catch (err) {
      setServerError(getErrorMessage(err, 'Could not save the meeting.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit meeting' : 'Schedule a meeting'}
      description="Meetings take place in the virtual meeting room. Employees can join from 10 minutes before the start."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="meeting-form" leftIcon={CalendarPlus} loading={saving}>
            {editing ? 'Save changes' : 'Schedule meeting'}
          </Button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={submit} className="space-y-4" noValidate>
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input label="Title" required value={form.title} onChange={set('title')} error={errors.title} placeholder="Weekly team sync" maxLength={120} />
        <div>
          <label htmlFor="meeting-description" className="label">
            Agenda <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="meeting-description"
            rows={3}
            maxLength={1000}
            value={form.description}
            onChange={set('description')}
            className="input resize-y"
            placeholder="What will be discussed?"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Input label="Starts" type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} error={errors.startsAt} />
          <Select label="Duration" value={form.duration} onChange={set('duration')}>
            {durationOptions.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Online meeting link"
          icon={LinkIcon}
          type="url"
          value={form.link}
          onChange={set('link')}
          error={errors.link}
          placeholder="https://meet.google.com/…  (optional)"
          hint="Paste a Google Meet, Zoom or Teams link. Leave empty to create a free Jitsi video room automatically."
        />
      </form>
    </Modal>
  );
}

export default ScheduleMeetingModal;
