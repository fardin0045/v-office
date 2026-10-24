import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { chatAPI } from '../services/api';
import { useToast } from '../components/ui/Feedback';
import { useAuth } from './AuthContext';
import { chatNotification, useSocket } from './SocketContext';

const ChatContext = createContext(null);

const byTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

function mergeMessages(current, incoming) {
  const map = new Map(current.map((m) => [String(m._id), m]));
  incoming.forEach((m) => map.set(String(m._id), m));
  return [...map.values()].sort(byTime);
}

/**
 * The company-wide team chat: message history, the pinned announcement and the unread badge.
 * History loads when the chat page first opens; the unread count is kept up to date everywhere.
 */
export function ChatProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { socket, addNotification } = useSocket();
  const toast = useToast();
  const userId = user?._id;

  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [unread, setUnread] = useState(0);
  // When the chat was last read before this visit, for the "New messages" divider.
  const [lastReadAt, setLastReadAt] = useState(null);

  const openRef = useRef(false);
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  const readTimer = useRef(null);

  const markRead = useCallback(() => {
    setUnread(0);
    clearTimeout(readTimer.current);
    // Coalesce bursts of incoming messages into one request.
    readTimer.current = setTimeout(() => chatAPI.markRead().catch(() => {}), 400);
  }, []);

  const isWatching = () => openRef.current && document.visibilityState === 'visible';

  // Reset everything on sign-in/out, and fetch the badge count.
  useEffect(() => {
    setMessages([]);
    setPinned(null);
    setHasMore(false);
    setLoaded(false);
    setUnread(0);
    setLastReadAt(null);
    if (!userId) return undefined;
    let cancelled = false;
    chatAPI
      .getUnread()
      .then((res) => !cancelled && !openRef.current && setUnread(res.data.count || 0))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadLatest = useCallback(async () => {
    const res = await chatAPI.getMessages();
    setMessages((prev) => mergeMessages(prev, res.data.messages));
    setPinned(res.data.pinned);
    if (!loadedRef.current) {
      setHasMore(res.data.hasMore);
      setLastReadAt(res.data.readAt);
    }
    setLoaded(true);
  }, []);

  const loadOlder = useCallback(async () => {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await chatAPI.getMessages(messages[0].createdAt);
      setMessages((prev) => mergeMessages(prev, res.data.messages));
      setHasMore(res.data.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [messages, loadingOlder]);

  // Live updates.
  useEffect(() => {
    if (!socket || !userId) return undefined;

    const onMessage = (message) => {
      if (!message?._id) return;
      if (loadedRef.current) setMessages((prev) => mergeMessages(prev, [message]));
      if (message.kind === 'announcement') setPinned(message);

      const mine = String(message.author?._id) === String(userId);
      if (mine) return;
      if (isWatching()) markRead();
      else setUnread((n) => n + 1);

      if (message.kind === 'announcement' || message.kind === 'absence') {
        const notification = chatNotification(message);
        addNotification(notification);
        if (!isWatching()) {
          const show = message.kind === 'announcement' ? toast.info : toast.warning;
          show(notification.message, { title: notification.title, duration: 6000 });
        }
      }
    };

    const onDeleted = ({ _id } = {}) => {
      if (!_id) return;
      setMessages((prev) => prev.map((m) => (String(m._id) === String(_id) ? { ...m, deleted: true, text: '', absenceDate: null } : m)));
      setPinned((p) => (p && String(p._id) === String(_id) ? null : p));
    };

    const onReconnect = () => {
      if (loadedRef.current) loadLatest().catch(() => {});
      if (!openRef.current) chatAPI.getUnread().then((res) => setUnread(res.data.count || 0)).catch(() => {});
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:deleted', onDeleted);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:deleted', onDeleted);
      socket.off('connect', onReconnect);
    };
  }, [socket, userId, markRead, addNotification, toast, loadLatest]);

  // The chat page reports when it is on screen; reading it clears the badge.
  const setChatOpen = useCallback(
    (open) => {
      openRef.current = open;
      if (open) markRead();
    },
    [markRead]
  );

  useEffect(() => {
    const onVisible = () => {
      if (isWatching()) markRead();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  useEffect(() => () => clearTimeout(readTimer.current), []);

  const send = useCallback(async (payload) => {
    const res = await chatAPI.send(payload);
    setMessages((prev) => mergeMessages(prev, [res.data]));
    if (res.data.kind === 'announcement') setPinned(res.data);
    return res.data;
  }, []);

  const remove = useCallback(async (id) => {
    await chatAPI.remove(id);
    setMessages((prev) => prev.map((m) => (String(m._id) === String(id) ? { ...m, deleted: true, text: '', absenceDate: null } : m)));
    setPinned((p) => (p && String(p._id) === String(id) ? null : p));
  }, []);

  const value = useMemo(
    () => ({
      enabled: isAuthenticated,
      messages,
      pinned,
      hasMore,
      loaded,
      loadingOlder,
      unread,
      lastReadAt,
      loadLatest,
      loadOlder,
      send,
      remove,
      setChatOpen,
    }),
    [isAuthenticated, messages, pinned, hasMore, loaded, loadingOlder, unread, lastReadAt, loadLatest, loadOlder, send, remove, setChatOpen]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
