import type { AuthUser, Role } from "@ps02/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getToken, setToken } from "../services/api";
import { loginRequest, meRequest, registerRequest, type RegisterPayload } from "../services/authApi";
import { connectSocket, disconnectSocket } from "../services/socket";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    if (!getToken()) {
      setLoading(false);
      return;
    }

    meRequest()
      .then((response) => {
        if (!alive) return;
        setUser(response.user);
        connectSocket();
      })
      .catch(() => {
        if (!alive) return;
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setToken(response.token);
    setUser(response.user);
    connectSocket();
    return response.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerRequest(payload);
    setToken(response.token);
    setUser(response.user);
    connectSocket();
    return response.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    disconnectSocket();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, hasRole }),
    [user, loading, login, register, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
