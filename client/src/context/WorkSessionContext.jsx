import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { workAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from '../components/ui/Feedback';

const WorkSessionContext = createContext(null);

/**
 * Single source of truth for the signed-in user's active work session. Updates are pushed via
 * Socket.IO (this tab, other tabs/devices, or admin actions) instead of every component polling.
 */
export function WorkSessionProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const userId = user?._id;

  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  // Bumped whenever the user's own sessions change, so pages can refetch stats/history.
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActiveSession(null);
      return null;
    }
    try {
      const res = await workAPI.getActiveSession();
      setActiveSession(res.data.activeSession || null);
      return res.data.activeSession || null;
    } catch {
      return null;
    }
  }, [userId]);

  useEffect(() => {
    setActiveSession(null);
    if (!userId) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [userId, refresh]);

  useEffect(() => {
    if (!socket || !userId) return undefined;

    const onStatusChange = (payload) => {
      if (String(payload?.employeeId) === String(userId)) {
        refresh();
        setRevision((r) => r + 1);
        if (payload.reason === 'auto-offline') {
          toast.info('You were checked out automatically after being away. Your time was saved up to when you left.');
        } else if (payload.reason === 'auto-max-duration') {
          toast.info('Your session reached the maximum length and was checked out automatically.');
        }
      }
    };
    const onReconnect = () => refresh();

    socket.on('employee:status_change', onStatusChange);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('employee:status_change', onStatusChange);
      socket.off('connect', onReconnect);
    };
  }, [socket, userId, refresh, toast]);

  // Resync when the tab becomes visible again (e.g. laptop wakes from sleep).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const startWork = useCallback(async (payload) => {
    const res = await workAPI.startWork(payload);
    setActiveSession(res.data.session);
    setRevision((r) => r + 1);
    return res.data;
  }, []);

  const endWork = useCallback(
    async (sessionId) => {
      const res = await workAPI.endWork(sessionId ? { sessionId } : {});
      if (String(res.data.session?.employeeId) === String(userId)) {
        setActiveSession(null);
        setRevision((r) => r + 1);
      }
      return res.data;
    },
    [userId]
  );

  const value = useMemo(
    () => ({ activeSession, loading, revision, refresh, startWork, endWork }),
    [activeSession, loading, revision, refresh, startWork, endWork]
  );

  return <WorkSessionContext.Provider value={value}>{children}</WorkSessionContext.Provider>;
}

export function useWorkSession() {
  const context = useContext(WorkSessionContext);
  if (!context) throw new Error('useWorkSession must be used within a WorkSessionProvider');
  return context;
}
