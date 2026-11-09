import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { chatAPI } from '../services/api';
import { useToast } from '../components/ui/Feedback';
import { useAuth } from './AuthContext';
import { chatNotification, useSocket } from './SocketContext';

const ChatContext = createContext(null);

const KINDS = ['message', 'absence', 'announcement'];
const EMPTY_MESSAGES = {
  message: [],
  absence: [],
  announcement: [],
};

const byTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

function mergeMessages(current = [], incoming = []) {
  const map = new Map(current.map((m) => [String(m._id), m]));
  incoming.forEach((m) => map.set(String(m._id), m));
  return [...map.values()].sort(byTime);
}

function normalizeKind(kind) {
  // Older database records without a kind are normal chat messages.
  return KINDS.includes(kind) ? kind : 'message';
}

/**
 * The company-wide team chat.
 * Each tab has its own message list and pagination state:
 * message, announcement, and absence.
 */
export function ChatProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { socket, addNotification } = useSocket();
  const toast = useToast();
  const userId = user?._id;

  const [messagesByKind, setMessagesByKind] = useState(EMPTY_MESSAGES);
  const [pinned, setPinned] = useState(null);
  const [hasMoreByKind, setHasMoreByKind] = useState({
    message: false,
    absence: false,
    announcement: false,
  });
  const [loadedByKind, setLoadedByKind] = useState({
    message: false,
    absence: false,
    announcement: false,
  });
  const [loadingOlderByKind, setLoadingOlderByKind] = useState({
    message: false,
    absence: false,
    announcement: false,
  });
  const [unread, setUnread] = useState(0);
  const [lastReadAt, setLastReadAt] = useState(null);

  const openRef = useRef(false);
  const loadedKindsRef = useRef(new Set());
  const latestRequestsRef = useRef(new Map());
  const loadingOlderKindsRef = useRef(new Set());
  const messagesByKindRef = useRef(messagesByKind);
  const readTimer = useRef(null);

  // Keep the latest state available to async callbacks without stale closures.
  messagesByKindRef.current = messagesByKind;

  const markRead = useCallback(() => {
    setUnread(0);
    clearTimeout(readTimer.current);
    // Coalesce bursts of incoming messages into one request.
    readTimer.current = setTimeout(
      () => chatAPI.markRead().catch(() => {}),
      400,
    );
  }, []);

  const isWatching = () =>
    openRef.current && document.visibilityState === 'visible';

  // Reset chat data on sign-in/sign-out and refresh the unread badge.
  useEffect(() => {
    setMessagesByKind(EMPTY_MESSAGES);
    setPinned(null);
    setHasMoreByKind({ message: false, absence: false, announcement: false });
    setLoadedByKind({ message: false, absence: false, announcement: false });
    setLoadingOlderByKind({
      message: false,
      absence: false,
      announcement: false,
    });
    setUnread(0);
    setLastReadAt(null);
    loadedKindsRef.current = new Set();
    latestRequestsRef.current.clear();
    loadingOlderKindsRef.current.clear();

    if (!userId) return undefined;

    let cancelled = false;
    chatAPI
      .getUnread()
      .then((res) => {
        if (!cancelled && !openRef.current) setUnread(res.data.count || 0);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Fetch the latest page for one tab. `kind` is sent to the backend as a query param.
  const loadLatest = useCallback(async (requestedKind = 'message') => {
    const kind = normalizeKind(requestedKind);
    const existingRequest = latestRequestsRef.current.get(kind);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      // chatAPI.getMessages must accept (before, kind); see the API change below.
      const res = await chatAPI.getMessages(undefined, kind);
      // Never trust a response to contain only the requested category.
      // Filter it here as well, so a backend/query mistake cannot mix tabs.
      const incoming = (res.data.messages || [])
        .map((message) => ({
          ...message,
          kind: normalizeKind(message.kind),
        }))
        .filter((message) => message.kind === kind);

      setMessagesByKind((prev) => {
        const existing = (prev[kind] || []).filter(
          (message) => normalizeKind(message.kind) === kind,
        );

        return {
          ...prev,
          [kind]: mergeMessages(existing, incoming),
        };
      });
      setHasMoreByKind((prev) => ({ ...prev, [kind]: !!res.data.hasMore }));
      setLoadedByKind((prev) => ({ ...prev, [kind]: true }));

      if (kind === 'announcement') {
        setPinned(res.data.pinned || null);
      }

      if (!loadedKindsRef.current.has(kind)) {
        loadedKindsRef.current.add(kind);
        if (kind === 'message') setLastReadAt(res.data.readAt || null);
      }

      return res;
    })();

    latestRequestsRef.current.set(kind, request);
    try {
      return await request;
    } finally {
      if (latestRequestsRef.current.get(kind) === request) {
        latestRequestsRef.current.delete(kind);
      }
    }
  }, []);

  // Fetch an older page for the selected tab only.
  const loadOlder = useCallback(async (requestedKind = 'message') => {
    const kind = normalizeKind(requestedKind);
    const currentMessages = messagesByKindRef.current[kind] || [];

    if (!currentMessages.length || loadingOlderKindsRef.current.has(kind))
      return;

    loadingOlderKindsRef.current.add(kind);
    setLoadingOlderByKind((prev) => ({ ...prev, [kind]: true }));

    try {
      const res = await chatAPI.getMessages(currentMessages[0].createdAt, kind);
      const incoming = (res.data.messages || [])
        .map((message) => ({
          ...message,
          kind: normalizeKind(message.kind),
        }))
        .filter((message) => message.kind === kind);

      setMessagesByKind((prev) => {
        const existing = (prev[kind] || []).filter(
          (message) => normalizeKind(message.kind) === kind,
        );

        return {
          ...prev,
          [kind]: mergeMessages(existing, incoming),
        };
      });
      setHasMoreByKind((prev) => ({ ...prev, [kind]: !!res.data.hasMore }));
    } finally {
      loadingOlderKindsRef.current.delete(kind);
      setLoadingOlderByKind((prev) => ({ ...prev, [kind]: false }));
    }
  }, []);

  // Live updates are stored in the matching category, never mixed into another tab.
  useEffect(() => {
    if (!socket || !userId) return undefined;

    const onMessage = (incomingMessage) => {
      if (!incomingMessage?._id) return;

      const kind = normalizeKind(incomingMessage.kind);
      const message = { ...incomingMessage, kind };

      if (loadedKindsRef.current.has(kind)) {
        setMessagesByKind((prev) => {
          const existing = (prev[kind] || []).filter(
            (item) => normalizeKind(item.kind) === kind,
          );

          return {
            ...prev,
            [kind]: mergeMessages(existing, [message]),
          };
        });
      }

      if (kind === 'announcement') setPinned(message);

      const mine = String(message.author?._id) === String(userId);
      if (mine) return;

      // Only normal chat messages affect the chat's unread badge.
      if (kind === 'message') {
        if (isWatching()) markRead();
        else setUnread((count) => count + 1);
      }

      // Absence notes and announcements still create their own notifications.
      if (kind === 'announcement' || kind === 'absence') {
        const notification = chatNotification(message);
        addNotification(notification);

        if (!isWatching()) {
          const show = kind === 'announcement' ? toast.info : toast.warning;
          show(notification.message, {
            title: notification.title,
            duration: 6000,
          });
        }
      }
    };

    const onDeleted = ({ _id } = {}) => {
      if (!_id) return;

      setMessagesByKind((prev) => {
        const next = { ...prev };
        KINDS.forEach((kind) => {
          next[kind] = (prev[kind] || []).map((message) =>
            String(message._id) === String(_id)
              ? { ...message, deleted: true, text: '', absenceDate: null }
              : message,
          );
        });
        return next;
      });

      setPinned((current) =>
        current && String(current._id) === String(_id) ? null : current,
      );
    };

    const onReconnect = () => {
      loadedKindsRef.current.forEach((kind) =>
        loadLatest(kind).catch(() => {}),
      );
      if (!openRef.current) {
        chatAPI
          .getUnread()
          .then((res) => setUnread(res.data.count || 0))
          .catch(() => {});
      }
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

  // The chat page reports when it is on screen; reading it clears the normal-message badge.
  const setChatOpen = useCallback(
    (open) => {
      openRef.current = open;
      if (open) markRead();
    },
    [markRead],
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
    const message = {
      ...res.data,
      kind: normalizeKind(res.data.kind),
    };

    setMessagesByKind((prev) => ({
      ...prev,
      [message.kind]: mergeMessages(prev[message.kind], [message]),
    }));

    if (message.kind === 'announcement') setPinned(message);
    return message;
  }, []);

  const remove = useCallback(async (id) => {
    await chatAPI.remove(id);

    setMessagesByKind((prev) => {
      const next = { ...prev };
      KINDS.forEach((kind) => {
        next[kind] = (prev[kind] || []).map((message) =>
          String(message._id) === String(id)
            ? { ...message, deleted: true, text: '', absenceDate: null }
            : message,
        );
      });
      return next;
    });

    setPinned((current) =>
      current && String(current._id) === String(id) ? null : current,
    );
  }, []);

  // Keep the original `messages` field available for any other component using it.
  const messages = useMemo(
    () =>
      mergeMessages(
        [],
        [
          ...(messagesByKind.message || []),
          ...(messagesByKind.announcement || []),
          ...(messagesByKind.absence || []),
        ],
      ),
    [messagesByKind],
  );

  const value = useMemo(
    () => ({
      enabled: isAuthenticated,
      messages,
      messagesByKind,
      pinned,
      hasMore: hasMoreByKind.message,
      hasMoreByKind,
      loaded: loadedByKind.message,
      loadedByKind,
      loadingOlder: loadingOlderByKind.message,
      loadingOlderByKind,
      unread,
      lastReadAt,
      loadLatest,
      loadOlder,
      send,
      remove,
      setChatOpen,
    }),
    [
      isAuthenticated,
      messages,
      messagesByKind,
      pinned,
      hasMoreByKind,
      loadedByKind,
      loadingOlderByKind,
      unread,
      lastReadAt,
      loadLatest,
      loadOlder,
      send,
      remove,
      setChatOpen,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}
