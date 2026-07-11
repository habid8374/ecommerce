import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const handleAuth = (data) => {
    tokenStore.set(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return handleAuth(data);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return handleAuth(data);
  };

  const updateProfile = async (payload) => {
    const { data } = await api.put("/auth/me", payload);
    setUser(data);
    return data;
  };

  const changeEmail = async (email, password) => {
    const { data } = await api.post("/auth/change-email", { email, password });
    setUser(data);
    return data;
  };

  const changePassword = async (current_password, new_password) => {
    await api.post("/auth/change-password", { current_password, new_password });
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const deleteAccount = async (password) => {
    await api.delete("/auth/me", { data: { password } });
    logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        updateProfile,
        changeEmail,
        changePassword,
        deleteAccount,
        logout,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
