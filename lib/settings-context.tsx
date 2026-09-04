'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppPreferences, CompanionSettings } from './types';

export const DEFAULT_PREFERENCES: AppPreferences = {
  companion: {
    persona: 'socratic',
    responseLength: 'balanced',
    customGuidance: '',
    showSuggestions: true,
  },
  editorFont: 'serif',
  editorFontSize: 'base',
  editorWidth: 'standard',
  showWordCount: true,
};

const STORAGE_KEY = 'inklume_user_preferences_v1';

interface SettingsContextType {
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  updateCompanionSettings: (patch: Partial<CompanionSettings>) => void;
  resetPreferences: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          companion: {
            ...DEFAULT_PREFERENCES.companion,
            ...(parsed.companion || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Could not load preferences from localStorage', e);
    }
    return DEFAULT_PREFERENCES;
  });
  const [isLoaded, setIsLoaded] = useState(true);

  // Save to localStorage when updated
  const savePreferences = (updated: AppPreferences) => {
    setPreferences(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist preferences to localStorage', e);
    }
  };

  const updatePreferences = (patch: Partial<AppPreferences>) => {
    savePreferences({
      ...preferences,
      ...patch,
    });
  };

  const updateCompanionSettings = (patch: Partial<CompanionSettings>) => {
    savePreferences({
      ...preferences,
      companion: {
        ...preferences.companion,
        ...patch,
      },
    });
  };

  const resetPreferences = () => {
    savePreferences(DEFAULT_PREFERENCES);
  };

  return (
    <SettingsContext.Provider
      value={{
        preferences,
        updatePreferences,
        updateCompanionSettings,
        resetPreferences,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
