import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, UNAUTHORIZED_EVENT } from '../services/api';
import { storage, TOKEN_KEY, USER_KEY } from '../lib/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (storage.get(TOKEN_KEY) ? storage.getJSON(USER_KEY) : null));
  // Only block rendering while there is a stored token to validate.
  const [loading, setLoading] = useState(() => Boolean(storage.get(TOKEN_KEY)));

  const persistSession = useCallback((data) => {
    const { token, ...userData } = data;
    if (token) storage.set(TOKEN_KEY, token);
    storage.set(USER_KEY, userData);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY, USER_KEY);
    setUser(null);
  }, []);

  // Validate the stored token once on startup.
  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) return undefined;
    let cancelled = false;

    authAPI
      .getMe()
      .then((res) => {
        if (cancelled) return;
        storage.set(USER_KEY, res.data);
        setUser(res.data);
      })
      .catch((err) => {
        // A rejected token signs the user out; a network blip keeps the cached session.
        if (!cancelled && err.response && [401, 403, 404].includes(err.response.status)) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Any 401 from the API (expired / revoked token) signs the user out.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  // Keep multiple tabs in sync (sign-in / sign-out / profile edits).
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === TOKEN_KEY && !event.newValue) setUser(null);
      if (event.key === USER_KEY && event.newValue) {
        try {
          setUser(JSON.parse(event.newValue));
        } catch {
          // ignore malformed values
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(
    async (email, password) => persistSession((await authAPI.login({ email, password })).data),
    [persistSession]
  );

  const register = useCallback(async (data) => persistSession((await authAPI.register(data)).data), [persistSession]);

  const updateProfile = useCallback(
    async (data) => persistSession((await authAPI.updateProfile(data)).data),
    [persistSession]
  );

  const toggleWorkMode = useCallback((mode) => updateProfile({ workMode: mode }), [updateProfile]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      updateProfile,
      toggleWorkMode,
    }),
    [user, loading, login, register, logout, updateProfile, toggleWorkMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
