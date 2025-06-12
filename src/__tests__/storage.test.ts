import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '@/lib/storage';
import type { BookmarkItem, ChatSession } from '@/types/models';

// Mock Chrome APIs
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    getBytesInUse: vi.fn(),
  },
};

global.chrome = {
  storage: mockChromeStorage,
} as any;

describe('Storage Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBookmarks', () => {
    it('should return empty array when no bookmarks stored', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});
      
      const bookmarks = await storage.getBookmarks();
      
      expect(bookmarks).toEqual([]);
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith('browsermate_bookmarks');
    });

    it('should return stored bookmarks', async () => {
      const testBookmarks: BookmarkItem[] = [
        {
          id: '1',
          title: 'Test Bookmark',
          url: 'https://example.com',
          dateAdded: Date.now(),
        },
      ];

      mockChromeStorage.local.get.mockResolvedValue({
        browsermate_bookmarks: testBookmarks,
      });

      const bookmarks = await storage.getBookmarks();

      expect(bookmarks).toEqual(testBookmarks);
    });
  });

  describe('setBookmarks', () => {
    it('should store bookmarks successfully', async () => {
      const testBookmarks: BookmarkItem[] = [
        {
          id: '1',
          title: 'Test Bookmark',
          url: 'https://example.com',
          dateAdded: Date.now(),
        },
      ];

      mockChromeStorage.local.set.mockResolvedValue(undefined);

      const result = await storage.setBookmarks(testBookmarks);

      expect(result).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        browsermate_bookmarks: testBookmarks,
      });
    });

    it('should handle storage errors', async () => {
      const testBookmarks: BookmarkItem[] = [];
      const error = new Error('Storage quota exceeded');
      
      mockChromeStorage.local.set.mockRejectedValue(error);

      const result = await storage.setBookmarks(testBookmarks);

      expect(result).toBe(false);
    });
  });

  describe('getChatSessions', () => {
    it('should return empty array when no sessions stored', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});
      
      const sessions = await storage.getChatSessions();
      
      expect(sessions).toEqual([]);
    });

    it('should return stored sessions', async () => {
      const testSessions: ChatSession[] = [
        {
          id: 'session-1',
          messages: [
            {
              id: 'msg-1',
              content: 'Hello',
              timestamp: Date.now(),
              type: 'user',
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockChromeStorage.local.get.mockResolvedValue({
        browsermate_chat_sessions: testSessions,
      });

      const sessions = await storage.getChatSessions();

      expect(sessions).toEqual(testSessions);
    });
  });

  describe('getSettings', () => {
    it('should return default settings when none stored', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});
      
      const settings = await storage.getSettings();
      
      expect(settings).toEqual({
        enabledSources: {
          bookmarks: true,
          history: true,
          readingList: true,
        },
        maxResults: 20,
        syncInterval: 30,
      });
    });

    it('should merge stored settings with defaults', async () => {
      mockChromeStorage.local.get.mockResolvedValue({
        browsermate_settings: {
          openaiApiKey: 'test-key',
          maxResults: 10,
        },
      });

      const settings = await storage.getSettings();

      expect(settings).toEqual({
        openaiApiKey: 'test-key',
        enabledSources: {
          bookmarks: true,
          history: true,
          readingList: true,
        },
        maxResults: 10,
        syncInterval: 30,
      });
    });
  });

  describe('getStorageUsage', () => {
    it('should return storage usage stats', async () => {
      mockChromeStorage.local.getBytesInUse.mockResolvedValue(1024);

      const usage = await storage.getStorageUsage();

      expect(usage).toEqual({
        used: 1024,
        total: 10 * 1024 * 1024, // 10MB
      });
    });

    it('should handle getBytesInUse errors', async () => {
      mockChromeStorage.local.getBytesInUse.mockRejectedValue(new Error('API error'));

      const usage = await storage.getStorageUsage();

      expect(usage).toEqual({
        used: 0,
        total: 10 * 1024 * 1024,
      });
    });
  });

  describe('clearAllData', () => {
    it('should clear all storage data', async () => {
      mockChromeStorage.local.clear.mockResolvedValue(undefined);

      const result = await storage.clearAllData();

      expect(result).toBe(true);
      expect(mockChromeStorage.local.clear).toHaveBeenCalled();
    });

    it('should handle clear errors', async () => {
      mockChromeStorage.local.clear.mockRejectedValue(new Error('Clear failed'));

      const result = await storage.clearAllData();

      expect(result).toBe(false);
    });
  });
}); 