import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, LoginRequest, RegisterRequest, AuthSessionResponse } from '@e-pramaan/shared';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<UserProfile | null>;
  register: (payload: RegisterRequest) => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('e_pramaan_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const storedToken = localStorage.getItem('e_pramaan_token');
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get<UserProfile>('/me');
      if (res.data) {
        setUser(res.data);
      }
    } catch (err) {
      // Session invalid or expired
      console.warn('[AuthContext] Session verification failed:', err);
      localStorage.removeItem('e_pramaan_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (credentials: LoginRequest): Promise<UserProfile | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<AuthSessionResponse>('/auth/login', credentials);
      if (res.data) {
        const { accessToken, user: profile } = res.data;
        localStorage.setItem('e_pramaan_token', accessToken);
        setToken(accessToken);
        setUser(profile);
        return profile;
      }
      return null;
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterRequest): Promise<UserProfile | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<AuthSessionResponse>('/auth/register', payload);
      if (res.data) {
        const { accessToken, user: profile } = res.data;
        localStorage.setItem('e_pramaan_token', accessToken);
        setToken(accessToken);
        setUser(profile);
        return profile;
      }
      return null;
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('e_pramaan_token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        error,
        login,
        register,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
