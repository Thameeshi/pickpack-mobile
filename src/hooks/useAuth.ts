import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  onAuthStateChange, getCurrentUser, logoutUser,
  loginUser, registerUser,
} from '../services/authService';
import { UserProfile, UserRole } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const p = await getCurrentUser();
          setProfile(p);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await loginUser(email, password);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (
    email: string, password: string, name: string, phone: string,
    role: UserRole, extra?: Partial<UserProfile>
  ) => {
    setLoading(true);
    try {
      const p = await registerUser(email, password, name, phone, role, extra);
      setProfile(p);
      return p;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await getCurrentUser();
      setProfile(p);
    }
  }, [user]);

  return { user, profile, loading, login, register, logout, refreshProfile };
}
