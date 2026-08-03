import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem(api.tokenKey)) {
      setLoading(false);
      return;
    }
    void api
      .me()
      .then((response) => setUser(response.user))
      .catch(() => localStorage.removeItem(api.tokenKey))
      .finally(() => setLoading(false));
  }, []);
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const response = await api.login(email, password);
        localStorage.setItem(api.tokenKey, response.token);
        setUser(response.user);
      },
      logout: () => {
        localStorage.removeItem(api.tokenKey);
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
