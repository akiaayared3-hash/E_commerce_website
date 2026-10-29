import { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "../lib/api.js"; // adjust path if needed

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on app start
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiRequest("/api/auth/me");
        const userData = res?.data?.user || res?.user || res?.data;
        setUser(userData || null);
      } catch (err) {
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login
  const login = async (email, password) => {
    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    const token =
      res?.token ||
      res?.accessToken ||
      res?.data?.token ||
      res?.data?.accessToken;

    if (!token) {
      throw new Error("No token returned from server");
    }

    localStorage.setItem("token", token);

    const userData = res?.user || res?.data?.user || res?.data;
    setUser(userData);

    return userData;
  };

  // Logout
  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // ignore error on logout
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
