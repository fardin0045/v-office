// localStorage can be unavailable (private mode, blocked storage) or hold corrupted JSON;
// none of that should ever crash the app.
export const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  getJSON(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // ignore quota / privacy errors
    }
  },
  remove(...keys) {
    try {
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // ignore
    }
  },
};

export const TOKEN_KEY = 'voffice_token';
export const USER_KEY = 'voffice_user';
