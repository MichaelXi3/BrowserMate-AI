import type {
  StorageData,
  BookmarkItem,
  HistoryItem,
  ReadingListItem,
  IndexedItem,
  ChatSession,
  AppSettings,
} from '@/types/models';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  enabledSources: {
    bookmarks: true,
    history: true,
    readingList: true,
  },
  maxResults: 20,
  syncInterval: 30, // 30 minutes
};

// Storage keys
const STORAGE_KEYS = {
  BOOKMARKS: 'browsermate_bookmarks',
  HISTORY: 'browsermate_history',
  READING_LIST: 'browsermate_reading_list',
  INDEXED_ITEMS: 'browsermate_indexed_items',
  CHAT_SESSIONS: 'browsermate_chat_sessions',
  SETTINGS: 'browsermate_settings',
  LAST_SYNC_TIME: 'browsermate_last_sync_time',
  SEARCH_INDEX: 'browsermate_search_index',
} as const;

class StorageManager {
  private static instance: StorageManager;

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Generic get method
  private async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error(`Error getting ${key} from storage:`, error);
      return null;
    }
  }

  // Generic set method
  private async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`Error setting ${key} in storage:`, error);
      return false;
    }
  }

  // Bookmarks
  async getBookmarks(): Promise<BookmarkItem[]> {
    return (await this.get<BookmarkItem[]>(STORAGE_KEYS.BOOKMARKS)) || [];
  }

  async setBookmarks(bookmarks: BookmarkItem[]): Promise<boolean> {
    return this.set(STORAGE_KEYS.BOOKMARKS, bookmarks);
  }

  // History
  async getHistory(): Promise<HistoryItem[]> {
    return (await this.get<HistoryItem[]>(STORAGE_KEYS.HISTORY)) || [];
  }

  async setHistory(history: HistoryItem[]): Promise<boolean> {
    return this.set(STORAGE_KEYS.HISTORY, history);
  }

  // Reading List
  async getReadingList(): Promise<ReadingListItem[]> {
    return (await this.get<ReadingListItem[]>(STORAGE_KEYS.READING_LIST)) || [];
  }

  async setReadingList(readingList: ReadingListItem[]): Promise<boolean> {
    return this.set(STORAGE_KEYS.READING_LIST, readingList);
  }

  // Indexed Items
  async getIndexedItems(): Promise<IndexedItem[]> {
    return (await this.get<IndexedItem[]>(STORAGE_KEYS.INDEXED_ITEMS)) || [];
  }

  async setIndexedItems(items: IndexedItem[]): Promise<boolean> {
    return this.set(STORAGE_KEYS.INDEXED_ITEMS, items);
  }

  // Chat Sessions
  async getChatSessions(): Promise<ChatSession[]> {
    return (await this.get<ChatSession[]>(STORAGE_KEYS.CHAT_SESSIONS)) || [];
  }

  async setChatSessions(sessions: ChatSession[]): Promise<boolean> {
    return this.set(STORAGE_KEYS.CHAT_SESSIONS, sessions);
  }

  async addChatSession(session: ChatSession): Promise<boolean> {
    const sessions = await this.getChatSessions();
    sessions.push(session);
    return this.setChatSessions(sessions);
  }

  async updateChatSession(sessionId: string, updatedSession: ChatSession): Promise<boolean> {
    const sessions = await this.getChatSessions();
    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index !== -1) {
      sessions[index] = updatedSession;
      return this.setChatSessions(sessions);
    }
    return false;
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    try {
      // Add timeout to storage access
      const timeoutPromise = new Promise<AppSettings>((_, reject) => 
        setTimeout(() => reject(new Error('Storage timeout')), 2000)
      );

      const settingsPromise = this.get<AppSettings>(STORAGE_KEYS.SETTINGS).then(settings => {
        return { ...DEFAULT_SETTINGS, ...settings };
      });

      const settings = await Promise.race([settingsPromise, timeoutPromise]);
      console.log('Storage: Retrieved settings:', settings);
      return settings;
    } catch (error) {
      console.warn('Storage: Error getting settings, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async setSettings(settings: Partial<AppSettings>): Promise<boolean> {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    return this.set(STORAGE_KEYS.SETTINGS, updatedSettings);
  }

  // Last Sync Time
  async getLastSyncTime(): Promise<number> {
    return (await this.get<number>(STORAGE_KEYS.LAST_SYNC_TIME)) || 0;
  }

  async setLastSyncTime(timestamp: number): Promise<boolean> {
    return this.set(STORAGE_KEYS.LAST_SYNC_TIME, timestamp);
  }

  // Search Index
  async getSearchIndex(): Promise<string | null> {
    return this.get<string>(STORAGE_KEYS.SEARCH_INDEX);
  }

  async setSearchIndex(serializedIndex: string): Promise<boolean> {
    return this.set(STORAGE_KEYS.SEARCH_INDEX, serializedIndex);
  }

  // Utility methods
  async getAllData(): Promise<Partial<StorageData>> {
    try {
      const [
        bookmarks,
        history,
        readingList,
        indexedItems,
        chatSessions,
        settings,
        lastSyncTime,
      ] = await Promise.all([
        this.getBookmarks(),
        this.getHistory(),
        this.getReadingList(),
        this.getIndexedItems(),
        this.getChatSessions(),
        this.getSettings(),
        this.getLastSyncTime(),
      ]);

      return {
        bookmarks,
        history,
        readingList,
        indexedItems,
        chatSessions,
        settings,
        lastSyncTime,
      };
    } catch (error) {
      console.error('Error getting all data:', error);
      return {};
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      await chrome.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }

  async getStorageUsage(): Promise<{ used: number; total: number }> {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      // Chrome local storage quota is usually 10MB
      return { used: usage, total: 10 * 1024 * 1024 };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { used: 0, total: 10 * 1024 * 1024 };
    }
  }
}

export const storage = StorageManager.getInstance();
export { STORAGE_KEYS }; 