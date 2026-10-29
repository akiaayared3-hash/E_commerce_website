import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "../lib/api.js";

const AuthContext = createContext(null);

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const readToken = () => localStorage.getItem("token");

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(readUser);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  // Merge new fields into the saved user (used by the profile page)
  const updateUser = useCallback((next) => {
    setUser((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });
  }, []);

  // api.js fires this when the server rejects an expired/invalid token
  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  // Keep several tabs in sync: login/logout in one tab updates the others
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token" || e.key === "user" || e.key === null) {
        setToken(readToken());
        setUser(readUser());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Refresh the user from the server once per session start.
  // A network error keeps the cached user. A 401 is handled by api.js,
  // which fires "auth:logout".
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("/api/users/me");
        const fresh = res?.user ?? res?.data?.user;
        if (!cancelled && fresh) updateUser(fresh);
      } catch {
        /* keep cached user */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, updateUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoggedIn: Boolean(token && user),
      login,
      logout,
      updateUser,
    }),
    [user, token, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
