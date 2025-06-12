import { describe, it, expect, beforeEach, vi } from 'vitest';
import { indexer } from '@/lib/indexer';
import type { IndexedItem, BookmarkItem } from '@/types/models';

// Mock FlexSearch
vi.mock('flexsearch', () => ({
  Index: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    search: vi.fn().mockReturnValue(['item1', 'item2']),
    export: vi.fn().mockReturnValue('serialized-index'),
    import: vi.fn(),
  })),
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  storage: {
    getSearchIndex: vi.fn(),
    setSearchIndex: vi.fn(),
    getIndexedItems: vi.fn(),
    setIndexedItems: vi.fn(),
    getBookmarks: vi.fn(),
    getHistory: vi.fn(),
    getReadingList: vi.fn(),
  },
}));

describe('Search Indexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should return empty array for empty query', async () => {
      const results = await indexer.search('');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace query', async () => {
      const results = await indexer.search('   ');
      expect(results).toEqual([]);
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild index from browser data', async () => {
      const mockBookmarks: BookmarkItem[] = [
        {
          id: '1',
          title: 'React Tutorial',
          url: 'https://example.com/react',
          dateAdded: Date.now(),
        },
      ];

      const { storage } = await import('@/lib/storage');
      vi.mocked(storage.getBookmarks).mockResolvedValue(mockBookmarks);
      vi.mocked(storage.getHistory).mockResolvedValue([]);
      vi.mocked(storage.getReadingList).mockResolvedValue([]);
      vi.mocked(storage.setIndexedItems).mockResolvedValue(true);

      await indexer.rebuildIndex();

      expect(storage.getBookmarks).toHaveBeenCalled();
      expect(storage.getHistory).toHaveBeenCalled();
      expect(storage.getReadingList).toHaveBeenCalled();
      expect(storage.setIndexedItems).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('should add item to index and storage', async () => {
      const testItem: IndexedItem = {
        id: 'test-1',
        title: 'Test Item',
        url: 'https://example.com',
        content: 'Test content',
        type: 'bookmark',
        timestamp: Date.now(),
      };

      const { storage } = await import('@/lib/storage');
      vi.mocked(storage.getIndexedItems).mockResolvedValue([]);
      vi.mocked(storage.setIndexedItems).mockResolvedValue(true);

      await indexer.addItem(testItem);

      expect(storage.setIndexedItems).toHaveBeenCalledWith([testItem]);
    });
  });

  describe('getStats', () => {
    it('should return index statistics', async () => {
      const { storage } = await import('@/lib/storage');
      vi.mocked(storage.getSearchIndex).mockResolvedValue('test-index');

      const stats = await indexer.getStats();

      expect(stats).toHaveProperty('totalItems');
      expect(stats).toHaveProperty('indexSize');
      expect(typeof stats.totalItems).toBe('number');
      expect(typeof stats.indexSize).toBe('number');
    });
  });
}); 