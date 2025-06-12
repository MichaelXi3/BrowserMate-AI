import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface.tsx';
import SourceFilters from './components/SourceFilters.tsx';
import Header from './components/Header.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import Snackbar from './components/Snackbar.tsx';
import type { ChatSession, AppSettings } from '@/types/models';

interface SnackbarState {
  show: boolean;
  message: string;
  type: 'error' | 'success' | 'info';
}

const App: React.FC = () => {
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
      console.log('Popup: Starting initialization...');
      
      // Try to check if runtime is available
      if (!chrome?.runtime?.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      console.log('Popup: Sending GET_SETTINGS message...');
      
      // Create a promise that will be resolved/rejected
      const settingsPromise = new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Popup: Chrome runtime error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            console.log('Popup: Raw response received:', response);
            
            if (!response) {
              reject(new Error('No response from background service'));
              return;
            }
            
            resolve(response);
          });
        } catch (error) {
          console.error('Popup: Error sending message:', error);
          reject(error);
        }
      });

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Background service timeout after 5 seconds')), 5000)
      );

      // Race between settings response and timeout
      console.log('Popup: Waiting for response...');
      const response = await Promise.race([settingsPromise, timeoutPromise]) as any;
      console.log('Popup: Received response:', response);

      if (response?.error) {
        throw new Error(response.error);
      }

      if (!response?.settings) {
        throw new Error('No settings received from background service');
      }

      setSettings(response.settings);
      console.log('Popup: Settings loaded successfully:', response.settings);

      // Check if API key is configured
      if (!response.settings?.openaiApiKey) {
        showSnackbar('Please configure your OpenAI API key in the options page', 'error');
      }
    } catch (error) {
      console.error('Popup: Error initializing app:', error);
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
      console.log('Popup: Using default settings due to error:', defaultSettings);
    } finally {
      setLoading(false);
      console.log('Popup: Initialization complete');
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
      console.log('Popup: Triggering manual sync...');
      
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
      console.error('Popup: Error during sync:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showSnackbar(`Sync failed: ${errorMessage}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleExpand = () => {
    // Open the chat interface in a new tab for full resizability
    chrome.tabs.create({
      url: chrome.runtime.getURL('chat/index.html')
    });
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading BrowserMate AI...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
        <Header 
          onOpenOptions={openOptionsPage}
          onSync={handleSync}
          onExpand={handleExpand}
          hasApiKey={!!settings?.openaiApiKey}
          isLoading={syncing}
        />
        
        {settings && (
          <>
            <SourceFilters
              settings={settings}
              onSettingsUpdate={handleSettingsUpdate}
              onShowSnackbar={showSnackbar}
            />
            
            <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
              <ChatInterface
                currentSession={currentSession}
                onSessionChange={setCurrentSession}
                settings={settings}
                onShowSnackbar={showSnackbar}
              />
            </div>
          </>
        )}

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

export default App; 