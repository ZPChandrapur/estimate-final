import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, AuthContextType } from '../types';

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
            display_name,
            description,
            level
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
          display_name: roleData.display_name,
          description: roleData.description,
          level: roleData.level
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
    setUser({
      ...authUser,
      role
    } as User);
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          // Clear invalid session data
          await supabase.auth.signOut();
        } else if (session?.user) {
          await setUserWithRole(session.user);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        // Clear any stale session data on catch
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('Error clearing stale session:', signOutError);
        }
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
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
        })();
      }
    );

    return () => subscription.unsubscribe();
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const hasPermission = (permission: string): boolean => {
    // Simplified permission check - can be enhanced later
    return true;
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};