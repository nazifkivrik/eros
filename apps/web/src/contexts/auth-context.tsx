"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface AuthUser {
  userId: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuthStatus = async () => {
    try {
      const status = await apiClient.getAuthStatus();
      console.log("Auth status:", status);
      if (status.authenticated && status.userId) {
        console.log("Setting user:", status.userId);
        setUser({ userId: status.userId });
      } else {
        console.log("Not authenticated");
        setUser(null);
      }
    } catch (error) {
      console.error("Auth status error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuthStatus();
  }, []);

  const login = async (username: string, password: string) => {
    const result = await apiClient.login(username, password);
    if (result.success) {
      // Refresh auth status to update state
      await refreshAuthStatus();
    }
    return result;
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
