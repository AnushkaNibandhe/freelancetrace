import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, UserRole } from '@/types/database';
import { apiJson, getToken, setToken } from '@/lib/api';

type User = { id: string; email: string } | null;
type Session = { token: string } | null;

const DEMO_STORAGE_KEY = 'freelancetrace.demo.role';

interface AuthContextType {
  user: User;
  session: Session;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: Error | null }>;
  adminSignUp: (email: string, password: string, fullName: string, secretKey: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, requiredRole?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const buildDemoState = (role: UserRole) => {
  const mockUser = {
    id: 'demo-user-id',
    email: 'demo@example.com',
  };

  const mockProfile: Profile = {
    id: 'demo-user-id',
    email: 'demo@example.com',
    full_name: 'Demo User',
    role: role,
    avatar_url: null,
    bio: 'This is a demo account.',
    organization_name: role === 'client' ? 'Demo Corp' : null,
    skills: role === 'freelancer' ? ['React', 'TypeScript', 'Node.js'] : null,
    tech_stack: null,
    github_username: 'demo-user',
    portfolio_url: null,
    hourly_rate: 50,
    total_earnings: 15000,
    total_spent: 5000,
    trust_score: 98,
    projects_completed: 12,
    dispute_rate: 0,
    is_verified: true,
    is_suspended: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockSession = { token: 'demo-token' };
  return { mockUser, mockProfile, mockSession };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [session, setSession] = useState<Session>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const storedDemoRole = localStorage.getItem(DEMO_STORAGE_KEY) as UserRole | null;
    if (storedDemoRole === 'client' || storedDemoRole === 'freelancer' || storedDemoRole === 'admin') {
      setIsDemo(true);
      const { mockUser, mockProfile, mockSession } = buildDemoState(storedDemoRole);
      setUser(mockUser);
      setProfile(mockProfile);
      setSession(mockSession);
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiJson<{ user: User; profile: Profile }>('/auth/me')
      .then((data) => {
        setUser(data.user);
        setProfile(data.profile);
        setSession({ token });
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    try {
      const data = await apiJson<{
        token: string;
        user: User;
        profile: Profile;
      }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
        }),
      });

      setToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      setSession({ token: data.token });
      setIsDemo(false);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string, requiredRole?: UserRole) => {
    try {
      const data = await apiJson<{
        token: string;
        user: User;
        profile: Profile;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (requiredRole && data.profile.role !== requiredRole) {
        return { error: new Error(`This portal is for ${requiredRole}s only. Please use the correct sign-in page.`) };
      }

      setToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      setSession({ token: data.token });
      setIsDemo(false);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const adminSignUp = async (email: string, password: string, fullName: string, secretKey: string) => {
    try {
      const data = await apiJson<{
        token: string;
        user: User;
        profile: Profile;
      }>('/auth/admin/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName, secret_key: secretKey }),
      });

      setToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      setSession({ token: data.token });
      setIsDemo(false);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await apiJson('/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout errors
    }
    setToken(null);
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsDemo(false);
    localStorage.removeItem(DEMO_STORAGE_KEY);
  };

  const loginAsDemo = async (role: UserRole) => {
    setIsDemo(true);
    localStorage.setItem(DEMO_STORAGE_KEY, role);
    const { mockUser, mockProfile, mockSession } = buildDemoState(role);
    setUser(mockUser);
    setProfile(mockProfile);
    setSession(mockSession);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const data = await apiJson<Profile>('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setProfile(data);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        adminSignUp,
        signIn,
        signOut,
        updateProfile,
        loginAsDemo,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
