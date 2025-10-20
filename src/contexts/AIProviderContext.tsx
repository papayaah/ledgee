'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AIProviderContextType {
  useOnlineGemini: boolean;
  setUseOnlineGemini: (use: boolean) => void;
  geminiApiKey: string | undefined;
  setGeminiApiKey: (key: string) => void;
}

const AIProviderContext = createContext<AIProviderContextType | undefined>(undefined);

const STORAGE_KEY = 'shawai_provider_preference';

export function AIProviderProvider({ children }: { children: ReactNode }) {
  const [useOnlineGemini, setUseOnlineGeminiState] = useState(false);
  const [geminiApiKey, setGeminiApiKeyState] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (typeof window !== 'undefined') {
        // Load provider preference
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          setUseOnlineGeminiState(saved === 'true');
        }

        // Load API key from database
        try {
          const { db } = await import('@/lib/database');
          const apiKeySetting = await db.settings.get('gemini_api_key');
          if (apiKeySetting?.value) {
            setGeminiApiKeyState(apiKeySetting.value as string);
          }
        } catch (error) {
          console.error('Failed to load Gemini API key:', error);
        }

        setIsInitialized(true);
      }
    };

    loadPreferences();
  }, []);

  // Save provider preference whenever it changes
  const setUseOnlineGemini = (use: boolean) => {
    setUseOnlineGeminiState(use);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(use));
    }
  };

  // Save API key to database
  const setGeminiApiKey = async (key: string) => {
    setGeminiApiKeyState(key);
    try {
      const { db } = await import('@/lib/database');
      await db.settings.put({
        key: 'gemini_api_key',
        value: key
      });
    } catch (error) {
      console.error('Failed to save Gemini API key:', error);
    }
  };

  // Don't render children until we've loaded the preferences
  if (!isInitialized) {
    return null;
  }

  return (
    <AIProviderContext.Provider value={{ useOnlineGemini, setUseOnlineGemini, geminiApiKey, setGeminiApiKey }}>
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider() {
  const context = useContext(AIProviderContext);
  if (context === undefined) {
    throw new Error('useAIProvider must be used within an AIProviderProvider');
  }
  return context;
}
