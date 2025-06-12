import FlexSearch from 'flexsearch';
import type { IndexedItem, SearchResult, BookmarkItem, HistoryItem, ReadingListItem } from '@/types/models';
import { storage } from './storage';

class SearchIndexer {
  private static instance: SearchIndexer;
  private index: FlexSearch.Index;
  private items: Map<string, IndexedItem> = new Map();
  private isInitialized = false;

  private constructor() {
    // Create lightweight FlexSearch index for memory efficiency
    this.index = new FlexSearch.Index({
      tokenize: 'forward',
      optimize: false, // Disable optimization to save memory
      cache: 10, // Reduce cache size significantly
    });
  }

  public static getInstance(): SearchIndexer {
    if (!SearchIndexer.instance) {
      SearchIndexer.instance = new SearchIndexer();
    }
    return SearchIndexer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Indexer: Starting initialization...');
      
      // Get existing indexed items from storage
      const indexedItems = await storage.getIndexedItems();
      console.log(`Indexer: Found ${indexedItems.length} items in storage`);

      if (indexedItems.length > 0) {
        console.log('Indexer: Items exist in storage, rebuilding FlexSearch index...');
        
        // Clear and rebuild the FlexSearch index from scratch
        this.index = new FlexSearch.Index({
          tokenize: 'forward',
          optimize: false,
          cache: 10,
        });
        this.items.clear();

        // Add all items to both memory map and FlexSearch index
        console.log('Indexer: Adding items to FlexSearch index...');
        for (const item of indexedItems) {
          this.addToIndex(item);
        }

        console.log(`Indexer: Successfully indexed ${this.items.size} items`);
        
        // Test the search to make sure it's working
        const testResults = this.index.search('test', { limit: 1 });
        console.log(`Indexer: Test search returned ${testResults.length} results`);
        
        // Test with first item if available
        if (indexedItems.length > 0) {
          const firstItem = indexedItems[0];
          const itemResults = this.index.search(firstItem.title.split(' ')[0], { limit: 5 });
          console.log(`Indexer: Search for "${firstItem.title.split(' ')[0]}" returned ${itemResults.length} results`);
        }
      } else {
        console.log('Indexer: No existing items found, will build when data is synced');
      }

      this.isInitialized = true;
      console.log('Indexer: Initialization complete');
    } catch (error) {
      console.error('Error initializing search index:', error);
      this.isInitialized = true;
    }
  }

  async rebuildIndex(): Promise<void> {
    console.log('Rebuilding search index...');
    
    try {
      // Clear existing index and items
      this.index = new FlexSearch.Index({
        tokenize: 'forward',
        optimize: false,
        cache: 10,
      });
      this.items.clear();

      // Get all data from storage
      const [bookmarks, history, readingList] = await Promise.all([
        storage.getBookmarks(),
        storage.getHistory(),
        storage.getReadingList(),
      ]);

      console.log(`Indexer: Rebuilding with ${bookmarks.length} bookmarks, ${history.length} history, ${readingList.length} reading list items`);

      // Convert to indexed items
      const indexedItems: IndexedItem[] = [
        ...this.convertBookmarksToIndexedItems(bookmarks),
        ...this.convertHistoryToIndexedItems(history),
        ...this.convertReadingListToIndexedItems(readingList),
      ];

      console.log(`Indexer: Total items to index: ${indexedItems.length}`);
      
      // Log breakdown by type
      const typeCount = indexedItems.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`Indexer: Items by type:`, typeCount);

      // Add to index
      for (const item of indexedItems) {
        this.addToIndex(item);
      }

      // Save to storage
      await this.persistIndex();
      await storage.setIndexedItems(Array.from(this.items.values()));

      console.log(`Rebuilt index with ${indexedItems.length} items`);
    } catch (error) {
      console.error('Error rebuilding index:', error);
      throw error;
    }
  }

  private convertBookmarksToIndexedItems(bookmarks: BookmarkItem[]): IndexedItem[] {
    const items: IndexedItem[] = [];

    const processBookmark = (bookmark: BookmarkItem) => {
      if (bookmark.url) {
        const content = `${bookmark.title || ''} ${bookmark.url}`.trim();
        items.push({
          id: `bookmark_${bookmark.id}`,
          title: bookmark.title || 'Untitled',
          url: bookmark.url,
          content,
          type: 'bookmark',
          timestamp: bookmark.dateAdded || Date.now(),
          snippet: this.generateSnippet(content),
        });
      }

      // Process children recursively
      if (bookmark.children) {
        bookmark.children.forEach(processBookmark);
      }
    };

    bookmarks.forEach(processBookmark);
    return items;
  }

  private convertHistoryToIndexedItems(history: HistoryItem[]): IndexedItem[] {
    return history
      .filter(item => item.url && item.title)
      .map(item => {
        const content = `${item.title || ''} ${item.url || ''}`.trim();
        return {
          id: `history_${item.id}`,
          title: item.title || 'Untitled',
          url: item.url || '',
          content,
          type: 'history' as const,
          timestamp: item.lastVisitTime || Date.now(),
          snippet: this.generateSnippet(content),
        };
      });
  }

  private convertReadingListToIndexedItems(readingList: ReadingListItem[]): IndexedItem[] {
    return readingList.map(item => {
      const content = `${item.title} ${item.url}`.trim();
      return {
        id: `reading_${item.url}`,
        title: item.title,
        url: item.url,
        content,
        type: 'reading-list' as const,
        timestamp: item.creationTime,
        snippet: this.generateSnippet(content),
      };
    });
  }

  private generateSnippet(content: string, maxLength = 200): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  private addToIndex(item: IndexedItem): void {
    // Add to FlexSearch index
    try {
      this.index.add(item.id, item.content);
    } catch (error) {
      console.error(`Indexer: Error adding item ${item.id} to FlexSearch:`, error);
    }
    
    // Store in items map for retrieval
    this.items.set(item.id, item);
  }

  async search(query: string, maxResults = 20): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!query.trim()) return [];

    // Check if we have any items indexed
    console.log(`Indexer: Search request for "${query}", items in memory: ${this.items.size}`);
    
    if (this.items.size === 0) {
      console.log('Indexer: No items indexed yet, index needs to be built');
      return [];
    }

    try {
      // Check if this is a "list all" type query
      const listAllPatterns = [
        /list|show|display|what.*do.*have|我的.*有什么|显示.*所有|列出/i,
        /bookmarks?|书签/i,
        /history|历史|浏览记录/i,
        /reading.?list|阅读清单|阅读列表/i
      ];
      
      const isListAllQuery = listAllPatterns.some(pattern => pattern.test(query));
      
      if (isListAllQuery) {
        console.log('Indexer: Detected list-all query, returning items by type');
        
        // Determine which types to include based on query
        const wantBookmarks = /bookmark|书签/i.test(query);
        const wantHistory = /history|历史|浏览记录/i.test(query);
        const wantReadingList = /reading.?list|阅读清单|阅读列表/i.test(query);
        
        // If no specific type mentioned, include all types
        const includeTypes: string[] = [];
        if (wantBookmarks || (!wantBookmarks && !wantHistory && !wantReadingList)) {
          includeTypes.push('bookmark');
        }
        if (wantHistory || (!wantBookmarks && !wantHistory && !wantReadingList)) {
          includeTypes.push('history');
        }
        if (wantReadingList || (!wantBookmarks && !wantHistory && !wantReadingList)) {
          includeTypes.push('reading-list');
        }
        
        console.log(`Indexer: Including types: ${includeTypes.join(', ')}`);
        
        // Get items of specified types
        const filteredItems = Array.from(this.items.values())
          .filter(item => includeTypes.includes(item.type))
          .sort((a, b) => b.timestamp - a.timestamp) // Sort by newest first
          .slice(0, maxResults);
          
        console.log(`Indexer: Found ${filteredItems.length} items for list-all query`);
        
        return filteredItems.map((item, index) => ({
          item,
          score: 10, // High score for exact type matches
          relevance: (maxResults - index) / maxResults,
        }));
      }

      // Regular keyword search
      // Extract meaningful search terms (remove common words)
      const cleanQuery = query.toLowerCase()
        .replace(/\b(list|show|find|get|my|the|a|an|我的|显示|列出|查找)\b/g, '')
        .trim();
      
      console.log(`Indexer: Cleaned query: "${cleanQuery}"`);
      
      let searchResults: any[] = [];
      
      // For Chinese queries, try different strategies
      if (/[\u4e00-\u9fff]/.test(cleanQuery)) {
        console.log('Indexer: Chinese query detected, using character-based search');
        
        // Try searching individual Chinese characters and common terms
        const chineseTerms = cleanQuery.match(/[\u4e00-\u9fff]+/g) || [];
        const englishTerms = cleanQuery.match(/[a-zA-Z]+/g) || [];
        
        const allTerms = [...chineseTerms, ...englishTerms].filter(term => term.length > 0);
        console.log(`Indexer: Extracted terms: ${allTerms.join(', ')}`);
        
        for (const term of allTerms) {
          console.log(`Indexer: Searching for term: "${term}"`);
          const termResults = this.index.search(term, { limit: maxResults * 2 });
          console.log(`Indexer: Term "${term}" returned ${termResults.length} results`);
          searchResults.push(...termResults);
        }
      } else {
        // English query processing
        const searchTerms = cleanQuery.split(/\s+/).filter(term => term.length > 2);
        console.log(`Indexer: Search terms: ${searchTerms.join(', ')}`);
        
        // Search for each term individually and combine results
        for (const term of searchTerms) {
          console.log(`Indexer: Searching for term: "${term}"`);
          const termResults = this.index.search(term, { limit: maxResults * 2 });
          console.log(`Indexer: Term "${term}" returned ${termResults.length} results`);
          searchResults.push(...termResults);
        }
      }
      
      // Remove duplicates
      searchResults = Array.from(new Set(searchResults));
      console.log(`Indexer: Combined results (${searchResults.length} unique):`, searchResults.slice(0, 10));
      
      // Convert to SearchResult objects with relevance scoring
      const results: SearchResult[] = [];
      
      for (let i = 0; i < Math.min(searchResults.length, maxResults); i++) {
        const itemId = searchResults[i] as string;
        const item = this.items.get(itemId);
        
        if (item) {
          const score = this.calculateRelevanceScore(cleanQuery, item);
          results.push({
            item,
            score,
            relevance: (maxResults - i) / maxResults, // Position-based relevance
          });
          console.log(`Indexer: Added result: ${item.title} (${item.type})`);
        } else {
          console.warn(`Indexer: Item ${itemId} found in search but not in items map`);
        }
      }

      // Sort by combined score and relevance
      results.sort((a, b) => (b.score + b.relevance) - (a.score + a.relevance));

      console.log(`Indexer: Returning ${results.length} processed results`);
      return results;
    } catch (error) {
      console.error('Error performing search:', error);
      return [];
    }
  }

  private calculateRelevanceScore(query: string, item: IndexedItem): number {
    const queryLower = query.toLowerCase();
    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();
    
    let score = 0;
    
    // Exact title match gets highest score
    if (titleLower === queryLower) score += 10;
    
    // Title contains query
    if (titleLower.includes(queryLower)) score += 5;
    
    // Content contains query
    if (contentLower.includes(queryLower)) score += 2;
    
    // Recent items get slight boost
    const daysSinceCreation = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) score += 1;
    
    // Bookmark items get slight boost (user explicitly saved)
    if (item.type === 'bookmark') score += 0.5;
    
    return score;
  }

  async addItem(item: IndexedItem): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.addToIndex(item);
    await this.persistIndex();
    
    // Update storage
    const currentItems = await storage.getIndexedItems();
    currentItems.push(item);
    await storage.setIndexedItems(currentItems);
  }

  async removeItem(itemId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Remove from index
    this.index.remove(itemId);
    this.items.delete(itemId);
    
    await this.persistIndex();
    
    // Update storage
    const currentItems = await storage.getIndexedItems();
    const filteredItems = currentItems.filter(item => item.id !== itemId);
    await storage.setIndexedItems(filteredItems);
  }

  async updateItem(item: IndexedItem): Promise<void> {
    await this.removeItem(item.id);
    await this.addItem(item);
  }

  private async persistIndex(): Promise<void> {
    try {
      // For FlexSearch, we need to get the serialized data differently
      const exportPromise = new Promise<string>((resolve) => {
        this.index.export((key: string | number, data: string) => {
          if (key === 'index') {
            resolve(data);
          }
        });
      });
      
      const serializedIndex = await exportPromise;
      await storage.setSearchIndex(serializedIndex);
    } catch (error) {
      console.error('Error persisting search index:', error);
    }
  }

  async getStats(): Promise<{ totalItems: number; indexSize: number }> {
    if (!this.isInitialized) {
      return { totalItems: 0, indexSize: 0 };
    }

    const serializedIndex = await storage.getSearchIndex();
    const indexSize = serializedIndex ? serializedIndex.length : 0;

    return {
      totalItems: this.items.size,
      indexSize,
    };
  }

  async clearIndex(): Promise<void> {
    this.index = new FlexSearch.Index({
      tokenize: 'forward',
      optimize: false,
      cache: 10,
    });
    this.items.clear();
    
    await storage.setSearchIndex('');
    await storage.setIndexedItems([]);
    
    console.log('Search index cleared');
  }
}

export const indexer = SearchIndexer.getInstance(); 