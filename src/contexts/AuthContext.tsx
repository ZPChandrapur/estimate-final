import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, AuthContextType } from '../types';
import { initializeAuthReceiver } from '../utils/authReceiver'; // ✅ ADD

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      if (data && data.roles) {
        const roleData = Array.isArray(data.roles) ? data.roles[0] : data.roles;
        return {
          id: roleData.id,
          name: roleData.name,
          description: roleData.description
        };
      }

      return null;
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      return null;
    }
  };

  const setUserWithRole = async (authUser: any) => {
    const role = await fetchUserRole(authUser.id);
    const hasFullAccess =
      role?.name === 'developer' || role?.name === 'super_admin';

    setUser({
      ...authUser,
      role,
      hasFullAccess
    } as User);
  };

  useEffect(() => {
    let subscription: any;

    const initAuth = async () => {
      try {
        // ✅ 1. VERY IMPORTANT: run auth receiver FIRST
        await initializeAuthReceiver('estimate');

        // ✅ 2. Then read session AFTER receiver sets tokens
        const { data: { session }, error } =
          await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          await supabase.auth.signOut();
        } else if (session?.user) {
          await setUserWithRole(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('Error clearing stale session:', signOutError);
        }
      } finally {
        setLoading(false);
      }

      // ✅ 3. Auth state listener (unchanged behavior)
      const { data } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          try {
            if (session?.user) {
              await setUserWithRole(session.user);
            } else {
              setUser(null);
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
          } finally {
            setLoading(false);
          }
        }
      );

      subscription = data.subscription;
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      setUser(null);
      throw error;
    }
  };

  const hasPermission = (_permission: string): boolean => {
    if (user?.hasFullAccess) return true;
    return true;
  };

  const hasFullAccess = (): boolean => {
    return user?.hasFullAccess || false;
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    hasPermission,
    hasFullAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
