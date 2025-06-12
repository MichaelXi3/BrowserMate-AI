import React from 'react';
import type { AppSettings } from '@/types/models';

interface SourceFiltersProps {
  settings: AppSettings;
  onSettingsUpdate: (settings: Partial<AppSettings>) => void;
  onShowSnackbar: (message: string, type?: 'error' | 'success' | 'info') => void;
}

const SourceFilters: React.FC<SourceFiltersProps> = ({
  settings,
  onSettingsUpdate,
  onShowSnackbar,
}) => {
  const toggleSource = async (source: keyof AppSettings['enabledSources']) => {
    const newEnabledSources = {
      ...settings.enabledSources,
      [source]: !settings.enabledSources[source],
    };

    try {
      // Update settings in background
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { enabledSources: newEnabledSources },
      });

      onSettingsUpdate({ enabledSources: newEnabledSources });
      onShowSnackbar(`${source} ${newEnabledSources[source] ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      console.error('Error updating settings:', error);
      onShowSnackbar('Failed to update settings', 'error');
    }
  };

  const sources = [
    {
      key: 'bookmarks' as const,
      label: 'Bookmarks',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      key: 'history' as const,
      label: 'History',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'readingList' as const,
      label: 'Reading List',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Search Sources</h3>
        <button
          onClick={() => chrome.runtime.sendMessage({ type: 'SYNC_REQUEST' })}
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          title="Sync browser data"
        >
          Sync
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const isEnabled = settings.enabledSources[source.key];
          return (
            <button
              key={source.key}
              onClick={() => toggleSource(source.key)}
              className={`
                flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-colors border
                ${
                  isEnabled
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {source.icon}
              <span>{source.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SourceFilters; 