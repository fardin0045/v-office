import { Link } from 'react-router-dom';
import { Boxes, CalendarClock, ExternalLink, Presentation, Video } from 'lucide-react';
import { activeParticipants, useMeetings } from '../../context/MeetingsContext';
import { getErrorMessage } from '../../services/api';
import { cn } from '../../lib/utils';
import { Button, Card, CardHeader, EmptyState, useToast } from '../ui';

const time = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (d) => {
  const date = new Date(d);
  return date.toDateString() === new Date().toDateString()
    ? 'Today'
    : date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export function MeetingsCard() {
  const { current, upcoming, isInMeeting, join } = useMeetings();
  const toast = useToast();
  const items = [...(current ? [current] : []), ...upcoming].slice(0, 3);

  const handleJoin = async (meeting) => {
    window.open(meeting.link, '_blank', 'noopener,noreferrer');
    try {
      await join(meeting._id);
      toast.success(`You joined “${meeting.title}”`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not join the meeting.'));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Meetings"
        description="In the virtual meeting room"
        icon={Presentation}
        action={
          <Button as={Link} to="/office?room=meeting" variant="ghost" size="sm" leftIcon={Boxes}>
            Open room
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No meetings scheduled" description="New meetings will appear here and you’ll get a notification." className="py-8" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((m) => {
            const joinable = m.status === 'live' || m.status === 'joinable';
            const joined = isInMeeting(m);
            return (
              <li key={m._id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    m.status === 'live' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-700'
                  )}
                >
                  <Video className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{m.title}</p>
                  <p className="text-xs text-slate-500">
                    {m.status === 'live' ? (
                      <span className="font-semibold text-emerald-600">Live now</span>
                    ) : (
                      day(m.startsAt)
                    )}{' '}
                    · {time(m.startsAt)} – {time(m.endsAt)} · {activeParticipants(m).length} in the room
                  </p>
                </div>
                {joined ? (
                  <Button as="a" href={m.link} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary" leftIcon={ExternalLink}>
                    Open call
                  </Button>
                ) : joinable ? (
                  <Button size="sm" variant="success" leftIcon={Video} onClick={() => handleJoin(m)}>
                    Join
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">Opens 10 min before</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default MeetingsCard;
