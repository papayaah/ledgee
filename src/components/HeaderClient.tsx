'use client';

import React, { useState, useEffect } from 'react';
import { FiSettings, FiEyeOff } from 'react-icons/fi';
import { checkChromeAIAvailability, ChromeAIStatus } from '@/lib/ai-extraction';

export default function HeaderClient() {
  const [debugMode, setDebugMode] = useState(false);
  const [aiStatus, setAiStatus] = useState<ChromeAIStatus>({
    available: false,
    status: 'Checking...',
    promptApiAvailable: false,
    languageModelAvailable: false,
    instructions: ''
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkChromeAIAvailability();
        setAiStatus(status);
      } catch (error) {
        console.error('Failed to check AI availability:', error);
        setAiStatus({
          available: false,
          status: 'Error checking availability',
          promptApiAvailable: false,
          languageModelAvailable: false,
          instructions: 'Failed to check Chrome AI availability'
        });
      }
    };

    checkStatus();
  }, []);

  // Store debug mode in localStorage to persist across page reloads
  useEffect(() => {
    const stored = localStorage.getItem('debugMode');
    if (stored !== null) {
      setDebugMode(JSON.parse(stored));
    }
  }, []);

  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    localStorage.setItem('debugMode', JSON.stringify(newMode));
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('debugModeChanged', { detail: newMode }));
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16">
              <img 
                src="/imgs/robot.gif" 
                alt="Shaw AI Robot" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold brand-gradient">
                Shaw AI
              </h1>
              <p className="text-xs text-muted-foreground -mt-1">
                Invoice Extraction
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Offline Ready Status - Now Functional */}
            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${
                aiStatus.available ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span>{aiStatus.available ? 'Offline Ready' : 'Setup Required'}</span>
            </div>
            
            {/* Language Model Status - Now Functional */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span className={`text-xs px-2 py-1 rounded-full ${
                aiStatus.languageModelAvailable 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {aiStatus.languageModelAvailable ? 'LanguageModel ✓' : 'LanguageModel ✗'}
              </span>
            </div>

            {/* Debug Toggle */}
            <button
              onClick={toggleDebugMode}
              className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted"
              title={debugMode ? "Hide debug tools" : "Show debug tools"}
            >
              {debugMode ? <FiEyeOff size={18} /> : <FiSettings size={18} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
