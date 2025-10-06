'use client';

import React, { useState, useEffect } from 'react';
import { checkChromeAIAvailability, ChromeAIStatus } from '@/lib/ai-extraction';

interface AIStatusIndicatorProps {
  onStatusChange?: (status: ChromeAIStatus) => void;
}

export default function AIStatusIndicator({ onStatusChange }: AIStatusIndicatorProps) {
  const [aiStatus, setAiStatus] = useState<ChromeAIStatus>({
    available: false,
    status: 'Checking...',
    promptApiAvailable: false,
    languageModelAvailable: false,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const status = await checkChromeAIAvailability();
      setAiStatus(status);
      setLastChecked(new Date());
      onStatusChange?.(status);
    } catch (error) {
      console.error('Failed to check AI status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Initial check
  useEffect(() => {
    checkStatus();
  }, []);

  // Auto-refresh every 30 seconds if not available
  useEffect(() => {
    if (aiStatus.available) return;

    const interval = setInterval(() => {
      checkStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [aiStatus.available]);

  const startDownload = async () => {
    if (!('LanguageModel' in window)) {
      setDownloadError('LanguageModel not available');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      const LanguageModel = (window as any).LanguageModel;
      
      // Create session with download progress monitoring
      const session = await LanguageModel.create({
        expectedInputs: [{ type: 'text' }],
        expectedOutputs: [{ type: 'text' }],
        monitor(m: any) {
          m.addEventListener('downloadprogress', (e: any) => {
            const progress = Math.round(e.loaded * 100);
            setDownloadProgress(progress);
            console.log(`AI Model Download Progress: ${progress}%`);
          });
        },
      });

      // Test the session to ensure it's working
      await session.prompt('Hello');
      
      // Download completed successfully
      setIsDownloading(false);
      setDownloadProgress(100);
      
      // Check status again to update the UI
      setTimeout(() => {
        checkStatus();
      }, 1000);
      
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadError(error instanceof Error ? error.message : 'Download failed');
      setIsDownloading(false);
    }
  };

  const startDemoDownload = () => {
    setDemoMode(true);
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    // Simulate download progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5; // Random increment between 5-20%
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsDownloading(false);
          setDemoMode(false);
          // Simulate successful completion
          setAiStatus({
            available: true,
            status: 'Gemini Nano multimodal model is ready',
            promptApiAvailable: true,
            languageModelAvailable: true,
          });
          onStatusChange?.({
            available: true,
            status: 'Gemini Nano multimodal model is ready',
            promptApiAvailable: true,
            languageModelAvailable: true,
          });
        }, 1000);
      }
      setDownloadProgress(Math.round(progress));
    }, 500); // Update every 500ms
  };

  const getStatusColor = () => {
    if (aiStatus.available) return 'text-green-600';
    if (aiStatus.status.includes('downloading')) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (aiStatus.available) return '✅';
    if (aiStatus.status.includes('downloading')) return '⏳';
    return '❌';
  };

  const getHelpfulMessage = () => {
    if (aiStatus.available) {
      return 'AI is ready! You can now upload invoice images.';
    }
    
    if (aiStatus.status.includes('downloading')) {
      return 'Chrome is downloading the AI model. This may take 5-15 minutes. Keep this tab open and wait.';
    }
    
    if (aiStatus.status.includes('not supported')) {
      return 'Your device doesn\'t support the AI model. Try using a different computer or Chrome version.';
    }
    
    if (aiStatus.status.includes('not detected')) {
      return 'Chrome AI is not enabled. Enable the required flags and restart Chrome Canary.';
    }
    
    return 'Chrome AI setup is required. Check the instructions below.';
  };

  const getEstimatedTime = () => {
    if (aiStatus.status.includes('downloading')) {
      return 'Estimated time: 5-15 minutes (varies by internet speed)';
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <h3 className="font-semibold text-foreground">AI Status</h3>
            <p className={`text-sm ${getStatusColor()}`}>
              {aiStatus.status}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={checkStatus}
            disabled={isChecking || isDownloading}
            className="text-sm px-3 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded border border-border transition-colors disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Refresh'}
          </button>
          
          {!aiStatus.available && !isDownloading && aiStatus.status.includes('downloading') && (
            <button
              onClick={startDownload}
              className="text-sm px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
            >
              Start Download
            </button>
          )}
          
          {/* Demo button - only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={startDemoDownload}
              disabled={isDownloading}
              className="text-sm px-3 py-1 bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors disabled:opacity-50"
            >
              {isDownloading && demoMode ? 'Demo Running...' : 'Demo Progress'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {getHelpfulMessage()}
        </p>
        
        {getEstimatedTime() && (
          <p className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 px-2 py-1 rounded">
            {getEstimatedTime()}
          </p>
        )}
        
        {isDownloading && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {demoMode ? 'Demo: Downloading AI Model...' : 'Downloading AI Model...'}
                </span>
                <span className="font-medium">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    demoMode ? 'bg-blue-500' : 'bg-primary'
                  }`}
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              💡 <strong>Tip:</strong> Keep this tab open and don't close Chrome Canary. 
              The download will pause if you close the browser.
            </div>
            {demoMode && (
              <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                🎭 <strong>Demo Mode:</strong> This is a simulation of the download progress. 
                In real usage, this would be the actual Chrome AI model download.
              </div>
            )}
          </div>
        )}

        {aiStatus.status.includes('downloading') && !isDownloading && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
              ⚠️ <strong>User interaction required:</strong> Click "Start Download" to begin downloading the AI model.
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              💡 <strong>Note:</strong> The download requires user interaction (click) to start, as per Chrome's security requirements.
            </div>
          </div>
        )}

        {downloadError && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
            ❌ <strong>Download Error:</strong> {downloadError}
          </div>
        )}
        
        {aiStatus.instructions && !aiStatus.available && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>Setup Instructions:</strong> {aiStatus.instructions}
          </div>
        )}
      </div>

      {lastChecked && (
        <div className="text-xs text-muted-foreground border-t border-border pt-2">
          Last checked: {lastChecked.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
