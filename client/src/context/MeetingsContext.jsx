import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { meetingAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { meetingNotification, useSocket } from './SocketContext';
import { useToast } from '../components/ui/Feedback';

const MeetingsContext = createContext(null);

const JOIN_EARLY_MS = 10 * 60 * 1000;

// Where a meeting stands at time `now`: upcoming → joinable (10 min early) → live → ended.
export function meetingStatus(meeting, now = Date.now()) {
  const start = new Date(meeting.startsAt).getTime();
  const end = new Date(meeting.endsAt).getTime();
  if (end <= now) return 'ended';
  if (start <= now) return 'live';
  if (start - JOIN_EARLY_MS <= now) return 'joinable';
  return 'upcoming';
}

export const canJoin = (meeting, now) => ['live', 'joinable'].includes(meetingStatus(meeting, now));

export const activeParticipants = (meeting) =>
  (meeting?.participants || []).filter((p) => !p.leftAt && p.user && typeof p.user === 'object');

const byStart = (a, b) => new Date(a.startsAt) - new Date(b.startsAt);

export function MeetingsProvider({ children }) {
  const { user } = useAuth();
  const { socket, addNotification } = useSocket();
  const toast = useToast();
  const userId = user?._id;

  const [meetings, setMeetings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Statuses depend on the clock, so re-evaluate regularly.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await meetingAPI.list();
      setMeetings([...res.data].sort(byStart));
    } catch {
      // keep the last known list
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    setMeetings([]);
    setLoaded(false);
    if (userId) refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (!socket || !userId) return undefined;

    const upsert = (meeting) => {
      if (!meeting?._id) return;
      setMeetings((prev) => {
        const rest = prev.filter((m) => m._id !== meeting._id);
        return meeting.cancelled ? rest : [...rest, meeting].sort(byStart);
      });
    };
    const remove = ({ meetingId } = {}) => setMeetings((prev) => prev.filter((m) => m._id !== meetingId));
    const scheduled = (payload) => {
      const notification = meetingNotification(payload);
      addNotification(notification);
      toast.info(notification.message, { title: `New meeting: ${payload.title}`, duration: 5000 });
    };

    socket.on('meeting:update', upsert);
    socket.on('meeting:removed', remove);
    socket.on('meeting:scheduled', scheduled);
    socket.on('connect', refresh);
    return () => {
      socket.off('meeting:update', upsert);
      socket.off('meeting:removed', remove);
      socket.off('meeting:scheduled', scheduled);
      socket.off('connect', refresh);
    };
  }, [socket, userId, refresh, addNotification, toast]);

  const upsertLocal = useCallback((meeting) => {
    setMeetings((prev) => [...prev.filter((m) => m._id !== meeting._id), meeting].sort(byStart));
  }, []);

  const actions = useMemo(
    () => ({
      create: async (data) => {
        const res = await meetingAPI.create(data);
        upsertLocal(res.data);
        return res.data;
      },
      update: async (id, data) => {
        const res = await meetingAPI.update(id, data);
        upsertLocal(res.data);
        return res.data;
      },
      cancel: async (id) => {
        await meetingAPI.cancel(id);
        setMeetings((prev) => prev.filter((m) => m._id !== id));
      },
      end: async (id) => {
        const res = await meetingAPI.end(id);
        upsertLocal(res.data);
        return res.data;
      },
      join: async (id) => {
        const res = await meetingAPI.join(id);
        upsertLocal(res.data);
        return res.data;
      },
      leave: async (id) => {
        const res = await meetingAPI.leave(id);
        upsertLocal(res.data);
        return res.data;
      },
    }),
    [upsertLocal]
  );

  const value = useMemo(() => {
    const withStatus = meetings.map((m) => ({ ...m, status: meetingStatus(m, now) }));
    const current = withStatus.find((m) => m.status === 'live') || null;
    const upcoming = withStatus.filter((m) => m.status === 'upcoming' || m.status === 'joinable');
    const recent = withStatus.filter((m) => m.status === 'ended').reverse();
    const isInMeeting = (meeting) =>
      Boolean(userId) && activeParticipants(meeting).some((p) => String(p.user._id) === String(userId));
    const myMeeting = withStatus.find((m) => m.status !== 'ended' && isInMeeting(m)) || null;
    return { meetings: withStatus, current, upcoming, recent, myMeeting, isInMeeting, loaded, now, refresh, ...actions };
  }, [meetings, now, userId, loaded, refresh, actions]);

  return <MeetingsContext.Provider value={value}>{children}</MeetingsContext.Provider>;
}

export function useMeetings() {
  const context = useContext(MeetingsContext);
  if (!context) throw new Error('useMeetings must be used within a MeetingsProvider');
  return context;
}
