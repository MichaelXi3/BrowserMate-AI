import React, { useState, useEffect } from 'react';
import ChatInterface from '@/popup/components/ChatInterface.tsx';
import SourceFilters from '@/popup/components/SourceFilters.tsx';
import ErrorBoundary from '@/popup/components/ErrorBoundary.tsx';
import Snackbar from '@/popup/components/Snackbar.tsx';
import type { ChatSession, AppSettings } from '@/types/models';

interface SnackbarState {
  show: boolean;
  message: string;
  type: 'error' | 'success' | 'info';
}

const ChatApp: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    show: false,
    message: '',
    type: 'info',
  });

  // Initialize app and load settings
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      console.log('Chat: Starting initialization...');
      
      // Try to check if runtime is available
      if (!chrome?.runtime?.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      console.log('Chat: Sending GET_SETTINGS message...');
      
      // Create a promise that will be resolved/rejected
      const settingsPromise = new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Chat: Chrome runtime error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            console.log('Chat: Raw response received:', response);
            
            if (!response) {
              reject(new Error('No response from background service'));
              return;
            }
            
            resolve(response);
          });
        } catch (error) {
          console.error('Chat: Error sending message:', error);
          reject(error);
        }
      });

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Background service timeout after 5 seconds')), 5000)
      );

      // Race between settings response and timeout
      console.log('Chat: Waiting for response...');
      const response = await Promise.race([settingsPromise, timeoutPromise]) as any;
      console.log('Chat: Received response:', response);

      if (response?.error) {
        throw new Error(response.error);
      }

      if (!response?.settings) {
        throw new Error('No settings received from background service');
      }

      setSettings(response.settings);
      console.log('Chat: Settings loaded successfully:', response.settings);

      // Check if API key is configured
      if (!response.settings?.openaiApiKey) {
        showSnackbar('Please configure your OpenAI API key in the options page', 'error');
      }
    } catch (error) {
      console.error('Chat: Error initializing app:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar(`Failed to initialize: ${errorMessage}`, 'error');
      
      // Even if there's an error, show the UI with default settings
      const defaultSettings = {
        enabledSources: {
          bookmarks: true,
          history: true,
          readingList: true,
        },
        maxResults: 20,
        syncInterval: 30,
      };
      setSettings(defaultSettings);
      console.log('Chat: Using default settings due to error:', defaultSettings);
    } finally {
      setLoading(false);
      console.log('Chat: Initialization complete');
    }
  };

  const showSnackbar = (message: string, type: SnackbarState['type'] = 'info') => {
    setSnackbar({ show: true, message, type });
  };

  const hideSnackbar = () => {
    setSnackbar(prev => ({ ...prev, show: false }));
  };

  const handleSettingsUpdate = (newSettings: Partial<AppSettings>) => {
    if (settings) {
      setSettings({ ...settings, ...newSettings });
    }
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleSync = async () => {
    if (syncing) return;
    
    try {
      setSyncing(true);
      console.log('Chat: Triggering manual sync...');
      
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_REQUEST' });
      
      if (response?.error) {
        throw new Error(response.error);
      }
      
      if (response?.success) {
        showSnackbar(`Successfully synced ${response.itemsCount || 0} items`, 'success');
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Chat: Error during sync:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar(`Sync failed: ${errorMessage}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-lg text-gray-400">Loading BrowserMate AI...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100">
        {/* Full-page header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <span className="text-primary-600 font-bold text-xl">B</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">BrowserMate AI</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {!settings?.openaiApiKey && (
              <div className="flex items-center space-x-2 text-yellow-200 bg-yellow-900/20 px-3 py-2 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>API Key Required</span>
              </div>
            )}
            
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2A8.001 8.001 0 0019.417 15M15 15h-4" />
              </svg>
              <span>Sync</span>
            </button>
            
            <button
              onClick={openOptionsPage}
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <div className="w-80 border-r border-gray-700 bg-gray-800 p-6">
            <h2 className="text-lg font-semibold mb-4">Search Sources</h2>
            {settings && (
              <SourceFilters
                settings={settings}
                onSettingsUpdate={handleSettingsUpdate}
                onShowSnackbar={showSnackbar}
              />
            )}
          </div>
          
          {/* Main chat area */}
          <div className="flex-1 flex flex-col bg-gray-900">
            {settings && (
              <ChatInterface
                currentSession={currentSession}
                onSessionChange={setCurrentSession}
                settings={settings}
                onShowSnackbar={showSnackbar}
              />
            )}
          </div>
        </div>

        <Snackbar
          show={snackbar.show}
          message={snackbar.message}
          type={snackbar.type}
          onClose={hideSnackbar}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ChatApp; 