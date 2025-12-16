// app/landlord/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, handleInvalidSession } from '../../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from storage on app start
  useEffect(() => {
    loadUser();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth event:', event);
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        // Clear local user state
        setUser(null);
        await AsyncStorage.removeItem('@landlord_user');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('[AuthContext] Token refreshed successfully');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const loadUser = async () => {
    try {
      // First check Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthContext] Session error:', error.message);
        // Handle invalid refresh token
        if (error.message.includes('Refresh Token') || error.message.includes('Invalid')) {
          await handleInvalidSession();
          setUser(null);
          await AsyncStorage.removeItem('@landlord_user');
          setIsLoading(false);
          return;
        }
      }

      if (!session) {
        // No valid session, clear local storage
        setUser(null);
        await AsyncStorage.removeItem('@landlord_user');
        setIsLoading(false);
        return;
      }

      // Session is valid, load user from storage
      const userJson = await AsyncStorage.getItem('@landlord_user');
      if (userJson) {
        try {
          const parsedUser = JSON.parse(userJson);
          setUser(parsedUser);
        } catch (parseError) {
          console.error('[AuthContext] Corrupted user data in storage, clearing:', parseError);
          // Clear corrupted data
          await AsyncStorage.removeItem('@landlord_user');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      // Handle refresh token errors
      if (error.message && (error.message.includes('Refresh Token') || error.message.includes('Invalid'))) {
        await handleInvalidSession();
        setUser(null);
        await AsyncStorage.removeItem('@landlord_user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData) => {
    try {
      setUser(userData);
      await AsyncStorage.setItem('@landlord_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      await AsyncStorage.removeItem('@landlord_user');
      // Sign out from Supabase as well
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Failed to remove user:', error);
    }
  };

  const updateUser = async (updatedUserData) => {
    try {
      const mergedUser = { ...user, ...updatedUserData };
      setUser(mergedUser);
      await AsyncStorage.setItem('@landlord_user', JSON.stringify(mergedUser));
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      updateUser,
      isLoading 
    }}>
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

// Default export to prevent routing warnings (not meant to be rendered as a screen)
export default AuthProvider;