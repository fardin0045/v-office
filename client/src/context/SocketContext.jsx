import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { authAPI, deskAPI, notificationAPI } from '../services/api';
import { useToast } from '../components/ui/Feedback';
import { storage, TOKEN_KEY } from '../lib/storage';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// Same origin by default (proxied by Vite in development, served by the API in production).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;
const MAX_NOTIFICATIONS = 30;

const byDeskId = (a, b) => String(a.deskId).localeCompare(String(b.deskId));

// Meetings scheduled by an admin, from the live socket event or the stored feed.
export function meetingNotification(event, time = event.time || new Date().toISOString()) {
  const when = new Date(event.startsAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return {
    id: `meeting-${event.meetingId}`,
    type: 'meeting',
    time,
    title: `Meeting scheduled: ${event.title}`,
    message: `${when} · Meeting room${event.createdBy ? ` · by ${event.createdBy}` : ''}`,
  };
}

const excerpt = (text, max = 90) => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// Announcements and absence notes from the team chat, live (chat message) or from the stored feed.
export function chatNotification(event, time = event.time || event.createdAt || new Date().toISOString()) {
  const name = event.authorName || event.author?.name || 'Someone';
  if (event.kind === 'announcement') {
    return {
      id: `chat-${event.messageId || event._id}`,
      type: 'announcement',
      time,
      title: `Announcement from ${name}`,
      message: excerpt(event.text),
    };
  }
  const [y, m, d] = String(event.absenceDate || '').split('-').map(Number);
  const day = y ? new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  return {
    id: `chat-${event.messageId || event._id}`,
    type: 'absence',
    time,
    title: `${name} will be away${day ? ` · ${day}` : ''}`,
    message: excerpt(event.text),
  };
}

// One shape for live socket events and stored activity, keyed so the same event never appears twice.
function toNotification(event, time = new Date().toISOString()) {
  if (event.kind === 'meeting') return meetingNotification(event, time);
  if (event.kind === 'announcement' || event.kind === 'absence') return chatNotification(event, time);
  const name = event.employeeName || 'An employee';
  const isRemote = event.mode === 'remote';
  if (event.status === 'working') {
    return {
      id: `${event.sessionId || `${event.employeeId}-${time}`}-in`,
      type: 'success',
      time,
      title: `${name} checked in`,
      message: event.deskId ? `${isRemote ? 'Working remotely from' : 'Working at'} ${event.deskId}` : 'Working remotely',
    };
  }
  const auto = String(event.reason || '').startsWith('auto');
  return {
    id: `${event.sessionId || `${event.employeeId}-${time}`}-out`,
    type: 'info',
    time,
    title: `${name} checked out`,
    message: auto ? 'Checked out automatically' : event.deskId ? `Left ${event.deskId}` : 'Finished remote work',
  };
}

const byNewest = (a, b) => new Date(b.time) - new Date(a.time);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [desks, setDesks] = useState([]);
  const [desksLoaded, setDesksLoaded] = useState(false);
  const [notifications, setNotifications] = useState([]);
  // Anything newer than this counts as unread. It is stored on the server, so unseen items stay
  // unseen across reloads and sign-ins until the user opens the bell. `null` = not loaded yet.
  const [lastReadAt, setLastReadAt] = useState(null);
  // IDs of employees who currently have V-Office open somewhere.
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [presenceReady, setPresenceReady] = useState(false);
  const { user } = useAuth();
  const userId = user?._id;
  const toast = useToast();
  // Read inside long-lived socket handlers without re-subscribing.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Bumped on every realtime write so a slower HTTP response can never overwrite fresher socket data.
  const version = useRef(0);

  const applySnapshot = useCallback((list) => {
    version.current += 1;
    setDesks([...list].sort(byDeskId));
    setDesksLoaded(true);
  }, []);

  const loadDesksFromAPI = useCallback(async () => {
    const startedAt = version.current;
    try {
      const res = await deskAPI.getAllDesks();
      if (version.current === startedAt) applySnapshot(res.data);
    } catch (err) {
      console.error('Failed to load desks:', err);
      setDesksLoaded(true);
    }
  }, [applySnapshot]);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) =>
      prev.some((n) => n.id === notification.id)
        ? prev
        : [notification, ...prev].sort(byNewest).slice(0, MAX_NOTIFICATIONS)
    );
  }, []);

  const unreadCount = useMemo(
    () => (lastReadAt === null ? 0 : notifications.filter((n) => new Date(n.time).getTime() > lastReadAt).length),
    [notifications, lastReadAt]
  );

  // Only opening the bell marks things as seen.
  const markNotificationsRead = useCallback(() => {
    setLastReadAt(Date.now());
    notificationAPI.markRead().catch(() => {});
  }, []);

  useEffect(() => {
    loadDesksFromAPI();

    const instance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    instance.on('connect', () => {
      setIsConnected(true);
      // Re-announce who we are after every (re)connect so presence survives network drops.
      const token = storage.get(TOKEN_KEY);
      if (token) instance.emit('presence:identify', token);
    });

    // The server refused our token (password changed elsewhere, account removed, expired). Re-check the
    // session: a 401 signs the user out through the API interceptor; a valid token (e.g. the new one
    // issued right after changing the password on this device) simply identifies again.
    instance.on('presence:rejected', () => {
      setTimeout(() => {
        if (!storage.get(TOKEN_KEY)) return;
        authAPI
          .getMe()
          .then(() => {
            const token = storage.get(TOKEN_KEY);
            if (token && instance.connected) instance.emit('presence:identify', token);
          })
          .catch(() => {});
      }, 1500);
    });

    instance.on('presence:snapshot', (ids) => {
      if (!Array.isArray(ids)) return;
      setOnlineIds(new Set(ids.map(String)));
      setPresenceReady(true);
    });
    instance.on('presence:update', ({ employeeId, online } = {}) => {
      if (!employeeId) return;
      setOnlineIds((prev) => {
        const id = String(employeeId);
        if (prev.has(id) === Boolean(online)) return prev;
        const next = new Set(prev);
        if (online) next.add(id);
        else next.delete(id);
        return next;
      });
    });
    instance.on('disconnect', () => {
      setIsConnected(false);
      setPresenceReady(false);
    });

    instance.on('office:snapshot', (list) => {
      if (Array.isArray(list)) applySnapshot(list);
    });

    instance.on('desk:update', (updated) => {
      if (!updated?.deskId) return;
      version.current += 1;
      setDesks((prev) => {
        const index = prev.findIndex((d) => d.deskId === updated.deskId);
        if (index === -1) return [...prev, updated].sort(byDeskId);
        const next = prev.slice();
        next[index] = updated;
        return next;
      });
    });

    instance.on('employee:status_change', (payload) => {
      if (payload?.status !== 'working' && payload?.status !== 'available') return;
      const notification = toNotification(payload);
      addNotification(notification);

      // Everyone signed in sees teammates come and go. Your own actions already show their own message.
      const me = userIdRef.current;
      if (me && String(payload.employeeId) !== String(me)) {
        const show = payload.status === 'working' ? toastRef.current.success : toastRef.current.info;
        show(notification.message, { title: notification.title, duration: 3500 });
      }
    });

    setSocket(instance);
    return () => {
      instance.removeAllListeners();
      instance.disconnect();
    };
  }, [loadDesksFromAPI, applySnapshot, addNotification]);

  // Tell the server who is using this browser whenever the signed-in user changes.
  useEffect(() => {
    if (!socket?.connected) return;
    const token = storage.get(TOKEN_KEY);
    if (userId && token) socket.emit('presence:identify', token);
    else socket.emit('presence:leave');
  }, [socket, userId]);

  // Load the stored feed (recent check-ins/outs and meetings) and when this user last opened it.
  useEffect(() => {
    setLastReadAt(null);
    if (!userId) {
      setNotifications([]);
      return undefined;
    }
    let cancelled = false;
    notificationAPI
      .getFeed()
      .then((res) => {
        if (cancelled || !Array.isArray(res.data?.items)) return;
        const stored = res.data.items.map((event) => toNotification(event, event.time));
        setNotifications((live) => {
          const seen = new Set(live.map((n) => n.id));
          return [...live, ...stored.filter((n) => !seen.has(n.id))].sort(byNewest).slice(0, MAX_NOTIFICATIONS);
        });
        setLastReadAt(res.data.readAt ? new Date(res.data.readAt).getTime() : 0);
      })
      .catch(() => {
        if (!cancelled) setLastReadAt(Date.now());
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isUserOnline = useCallback((id) => Boolean(id) && onlineIds.has(String(id)), [onlineIds]);
  // "Away" is only meaningful once we know who is online; before that, assume everyone is.
  const isUserAway = useCallback((id) => presenceReady && !isUserOnline(id), [presenceReady, isUserOnline]);

  const refreshDesks = useCallback(() => {
    if (socket?.connected) socket.emit('desk:request_refresh');
    else loadDesksFromAPI();
  }, [socket, loadDesksFromAPI]);

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      desks,
      desksLoaded,
      notifications,
      unreadCount,
      markNotificationsRead,
      addNotification,
      refreshDesks,
      onlineIds,
      isUserOnline,
      isUserAway,
    }),
    [
      socket,
      isConnected,
      desks,
      desksLoaded,
      notifications,
      unreadCount,
      markNotificationsRead,
      addNotification,
      refreshDesks,
      onlineIds,
      isUserOnline,
      isUserAway,
    ]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}
