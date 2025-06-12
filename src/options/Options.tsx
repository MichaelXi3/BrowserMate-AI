import React, { useState, useEffect } from 'react';
import type { AppSettings } from '@/types/models';

const Options: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [storageStats, setStorageStats] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    loadSettings();
    loadStorageStats();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.settings) {
        setSettings(response.settings);
        setApiKey(response.settings.openaiApiKey || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStorageStats = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STORAGE_STATS' });
      if (response.stats) {
        setStorageStats(response.stats);
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        openaiApiKey: apiKey.trim(),
      };

      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: updatedSettings,
      });

      setSettings(updatedSettings);
      showMessage('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRebuildIndex = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'REBUILD_INDEX' });
      showMessage('Search index rebuilt successfully!', 'success');
      loadStorageStats(); // Refresh storage stats
    } catch (error) {
      console.error('Error rebuilding index:', error);
      showMessage('Failed to rebuild index', 'error');
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to delete all stored data? This action cannot be undone.')) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
      showMessage('All data cleared successfully!', 'success');
      loadStorageStats(); // Refresh storage stats
    } catch (error) {
      console.error('Error clearing data:', error);
      showMessage('Failed to clear data', 'error');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              BrowserMate AI Settings
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Configure your AI assistant and manage your data
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* API Configuration */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                OpenAI Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Your OpenAI API key is stored locally and never shared
                  </p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>

            {/* Data Management */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Data Management
              </h2>
              <div className="space-y-4">
                {storageStats && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Storage Usage
                    </h3>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Used: {formatBytes(storageStats.used)}</span>
                      <span>Total: {formatBytes(storageStats.total)}</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${(storageStats.used / storageStats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleRebuildIndex}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    Rebuild Search Index
                  </button>
                  <button
                    onClick={handleClearAllData}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    Delete All Data
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Rebuilding the index will refresh your search data. Clearing all data will remove all stored bookmarks, history, and chat sessions.
                </p>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Privacy & Data
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Your Data Stays Private
                </h3>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• All browser data is stored locally on your device</li>
                  <li>• Only minimal context (titles, URLs, snippets) is sent to OpenAI for responses</li>
                  <li>• Your API key is stored securely in Chrome's local storage</li>
                  <li>• No data is shared with third parties or external servers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
            message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default Options; 