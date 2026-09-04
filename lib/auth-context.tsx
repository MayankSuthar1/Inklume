'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  hardDeleteUserData,
} from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccountAndData: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-in failed');
      setError(err?.message || 'Unable to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      await signOutUser();
    } catch (err: any) {
      console.error('Sign-out failed');
      setError(err?.message || 'Failed to sign out.');
    }
  };

  const handleDeleteAccountAndData = async () => {
    if (!user) return;
    try {
      setError(null);
      setLoading(true);
      const uid = user.uid;
      // 1. Hard delete all entries and user doc in Firestore
      await hardDeleteUserData(uid);
      // 2. Delete the user authentication record if possible, or sign out
      try {
        await user.delete();
      } catch (authErr: any) {
        // If re-auth is required to delete Firebase Auth user, sign out cleanly
        console.warn('Auth user delete requires recent sign in; signing out user instead.');
        await signOutUser();
      }
      setUser(null);
    } catch (err: any) {
      console.error('Failed to delete account data');
      setError(err?.message || 'Failed to delete all account data. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn: handleSignIn,
        signOut: handleSignOut,
        deleteAccountAndData: handleDeleteAccountAndData,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
