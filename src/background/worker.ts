import OpenAI from 'openai';
import { storage } from '@/lib/storage';
import { indexer } from '@/lib/indexer';
import type {
  ChatMessage,
  ChatSession,
  BookmarkItem,
  HistoryItem,
  ReadingListItem,
  ChatRequest,
  ChatResponse,
  SyncResponse,
} from '@/types/models';

// Rate limiting for OpenAI API
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens = 1, refillRate = 1) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 1;
    }

    this.tokens -= 1;
  }
}

class BackgroundService {
  private openai: OpenAI | null = null;
  private rateLimiter = new RateLimiter(1, 1); // 1 request per second
  public isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Background: Starting lightweight service initialization...');
    
    try {
      // Mark as initialized immediately so message handlers work
      this.isInitialized = true;
      console.log('Background service marked as initialized');

      // Setup OpenAI client (quick operation)
      await this.setupOpenAI();
      console.log('Background: OpenAI client setup complete');

      // Setup periodic sync (quick operation)
      await this.setupPeriodicSync();
      console.log('Background: Periodic sync setup complete');

      console.log('Background service fully initialized');
      
      // Heavy operations will only happen when actually needed
      // No longer doing indexer initialization or sync during startup
    } catch (error) {
      console.error('Error during background service initialization:', error);
      // Still mark as initialized so basic functionality works
      this.isInitialized = true;
    }
  }

  private async setupOpenAI(): Promise<void> {
    const settings = await storage.getSettings();
    if (settings.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: false, // We're in a service worker
      });
    }
  }

  private async setupPeriodicSync(): Promise<void> {
    // Clear existing alarms
    await chrome.alarms.clearAll();

    // Set up new alarm
    const settings = await storage.getSettings();
    await chrome.alarms.create('sync-browser-data', {
      periodInMinutes: settings.syncInterval,
    });
  }

  async syncBrowserData(): Promise<{ success: boolean; itemsCount: number }> {
    console.log('Background: Starting browser data sync...');
    
    try {
      // Check permissions
      console.log('Background: Checking browser API access...');
      console.log('Background: Bookmarks API available:', !!chrome.bookmarks);
      console.log('Background: History API available:', !!chrome.history);
      console.log('Background: Reading List API available:', !!(chrome as any).readingList);

      const [bookmarks, history, readingList] = await Promise.all([
        this.getBookmarks(),
        this.getHistory(),
        this.getReadingList(),
      ]);

      console.log(`Background: Fetched ${bookmarks.length} bookmarks`);
      console.log(`Background: Fetched ${history.length} history items`);
      console.log(`Background: Fetched ${readingList.length} reading list items`);

      // Store raw data
      await Promise.all([
        storage.setBookmarks(bookmarks),
        storage.setHistory(history),
        storage.setReadingList(readingList),
      ]);

      console.log('Background: Data stored, rebuilding search index...');

      // Rebuild search index
      await indexer.rebuildIndex();

      // Update last sync time
      await storage.setLastSyncTime(Date.now());

      const totalItems = bookmarks.length + history.length + readingList.length;
      console.log(`Background: Sync complete - total ${totalItems} items indexed`);

      return { success: true, itemsCount: totalItems };
    } catch (error) {
      console.error('Background: Error syncing browser data:', error);
      return { success: false, itemsCount: 0 };
    }
  }

  private async getBookmarks(): Promise<BookmarkItem[]> {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const bookmarks: BookmarkItem[] = [];

      const processNode = (node: chrome.bookmarks.BookmarkTreeNode) => {
        if (node.url) {
          bookmarks.push({
            id: node.id,
            title: node.title,
            url: node.url,
            dateAdded: node.dateAdded,
            parentId: node.parentId,
            index: node.index,
          });
        }
        if (node.children) {
          node.children.forEach(processNode);
        }
      };

      bookmarkTree.forEach(processNode);
      return bookmarks;
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return [];
    }
  }

  private async getHistory(): Promise<HistoryItem[]> {
    try {
      // Get much less history to prevent memory issues - only last 7 days and max 1000 items
      const startTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const historyItems = await chrome.history.search({
        text: '',
        startTime,
        maxResults: 1000, // Reduced from 10000 to 1000
      });

      return historyItems.map(item => ({
        id: item.id || '',
        url: item.url,
        title: item.title,
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount,
        typedCount: item.typedCount,
      }));
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }

  private async getReadingList(): Promise<ReadingListItem[]> {
    try {
      // Reading List API might not be available in all Chrome versions
      if (!(chrome as any).readingList) {
        return [];
      }

      const readingListItems = await (chrome as any).readingList.query({});
      return readingListItems.map((item: any) => ({
        title: item.title,
        url: item.url,
        hasBeenRead: item.hasBeenRead,
        creationTime: item.creationTime,
        lastUpdateTime: item.lastUpdateTime,
      }));
    } catch (error) {
      console.error('Error getting reading list:', error);
      return [];
    }
  }

  async handleChatRequest(request: ChatRequest): Promise<ChatResponse> {
    const { query, sessionId } = request.payload;

    try {
      if (!this.openai) {
        throw new Error('OpenAI API key not configured');
      }

      // Rate limit
      await this.rateLimiter.waitForToken();

      // Initialize indexer only when actually needed for chat
      console.log('Background: Initializing indexer for chat request...');
      await indexer.initialize();

      // Check if we have data, if not, sync first
      const indexStats = await indexer.getStats();
      console.log(`Background: Current index stats:`, indexStats);
      
      if (indexStats.totalItems === 0) {
        console.log('Background: No data indexed yet, performing sync...');
        try {
          const syncResult = await this.syncBrowserData();
          if (!syncResult.success) {
            console.error('Background: Sync failed');
            throw new Error('Failed to sync browser data. Please check extension permissions.');
          }
          console.log(`Background: Successfully synced ${syncResult.itemsCount} items`);
          
          // Verify data was actually indexed
          const newStats = await indexer.getStats();
          console.log(`Background: Post-sync index stats:`, newStats);
          
          if (newStats.totalItems === 0) {
            throw new Error('No bookmarks, history, or reading list items found. Please ensure you have data to search and the extension has proper permissions.');
          }
        } catch (syncError) {
          console.error('Background: Error during sync:', syncError);
          throw new Error(`Data sync failed: ${syncError instanceof Error ? syncError.message : 'Unknown error'}`);
        }
      }

      // Search for relevant items
      const searchResults = await indexer.search(query, 20);
      console.log(`Background: Raw search results: ${searchResults.length} items`);
      
      // Filter by enabled sources
      const settings = await storage.getSettings();
      console.log(`Background: Enabled sources:`, settings.enabledSources);
      
      const filteredResults = searchResults.filter(result => {
        const { type } = result.item;
        let isEnabled = false;
        
        switch (type) {
          case 'bookmark':
            isEnabled = settings.enabledSources.bookmarks;
            break;
          case 'history':
            isEnabled = settings.enabledSources.history;
            break;
          case 'reading-list':
            isEnabled = settings.enabledSources.readingList;
            break;
          default:
            isEnabled = true;
        }
        
        console.log(`Background: Item ${result.item.title} (${type}) - enabled: ${isEnabled}`);
        return isEnabled;
      });
      
      console.log(`Background: After filtering by enabled sources: ${filteredResults.length} items`);

      // Prepare context for RAG
      const context = filteredResults.slice(0, settings.maxResults).map(result => ({
        title: result.item.title,
        url: result.item.url,
        snippet: result.item.snippet || result.item.content.substring(0, 200),
        type: result.item.type,
        timestamp: result.item.timestamp,
      }));
      
      console.log(`Background: Final context for AI: ${context.length} items`);
      context.forEach((item, index) => {
        console.log(`Background: Context ${index + 1}: ${item.title} (${item.type})`);
      });

      // Generate response using OpenAI
      const systemPrompt = `You are BrowserMate AI, a helpful assistant that helps users find and understand information from their browser data (bookmarks, history, and reading list).

Your role is to:
1. Answer questions about the user's browsing data using the provided context
2. Provide relevant links and references from their browser data
3. Be concise but informative in your responses
4. If no relevant information is found, acknowledge this and suggest ways to refine the search

Special instructions for different query types:
- When users ask "what do I have" or "list my X" (like "我的阅读清单有什么"), they want to see ALL items of that type
- For Chinese queries, be extra careful about understanding the intent
- If the context contains items, list them clearly with their titles and URLs
- If the context is empty, explain that no items were found and suggest checking if data is synced

Always format your response in Markdown and include relevant links when available.
Be especially helpful for Chinese users and understand queries like "我的阅读清单有什么" mean "show me all my reading list items".`;

      const userPrompt = `User query: "${query}"

Available context from browser data:
${JSON.stringify(context, null, 2)}

Please provide a helpful response based on this data. If the context contains items, list them clearly. If it's empty, explain why and provide helpful suggestions.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const assistantMessage = completion.choices[0]?.message?.content || 'I could not generate a response.';

      // Create chat message
      const chatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: assistantMessage,
        timestamp: Date.now(),
        type: 'assistant',
        sources: filteredResults.slice(0, 5).map(result => result.item), // Include top 5 sources
      };

      // Handle session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = crypto.randomUUID();
        const newSession: ChatSession = {
          id: currentSessionId,
          messages: [
            {
              id: crypto.randomUUID(),
              content: query,
              timestamp: Date.now(),
              type: 'user',
            },
            chatMessage,
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.addChatSession(newSession);
      } else {
        // Update existing session
        const sessions = await storage.getChatSessions();
        const session = sessions.find(s => s.id === currentSessionId);
        if (session) {
          session.messages.push({
            id: crypto.randomUUID(),
            content: query,
            timestamp: Date.now(),
            type: 'user',
          });
          session.messages.push(chatMessage);
          session.updatedAt = Date.now();
          await storage.updateChatSession(currentSessionId, session);
        }
      }

      return {
        type: 'CHAT_RESPONSE',
        payload: {
          message: chatMessage,
          sessionId: currentSessionId,
        },
      };
    } catch (error) {
      console.error('Error handling chat request:', error);
      
      return {
        type: 'CHAT_RESPONSE',
        payload: {
          message: {
            id: crypto.randomUUID(),
            content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
            type: 'assistant',
          },
          sessionId: sessionId || crypto.randomUUID(),
        },
      };
    }
  }

  async handleSyncRequest(): Promise<SyncResponse> {
    const result = await this.syncBrowserData();
    const lastSyncTime = await storage.getLastSyncTime();

    return {
      type: 'SYNC_RESPONSE',
      payload: {
        success: result.success,
        itemsCount: result.itemsCount,
        lastSyncTime,
      },
    };
  }

  async handleGetSettings(): Promise<{ settings: any }> {
    console.log('Background: handleGetSettings called');
    try {
      const settings = await storage.getSettings();
      console.log('Background: Retrieved settings:', settings);
      return { settings };
    } catch (error) {
      console.error('Background: Error getting settings:', error);
      throw error;
    }
  }

  async handleUpdateSettings(newSettings: any): Promise<{ success: boolean }> {
    try {
      await storage.setSettings(newSettings);
      // Update OpenAI client if API key changed
      if (newSettings.openaiApiKey) {
        await this.setupOpenAI();
      }
      // Update sync interval if changed
      if (newSettings.syncInterval) {
        await this.setupPeriodicSync();
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false };
    }
  }

  async handleGetStorageStats(): Promise<{ stats: any }> {
    const stats = await storage.getStorageUsage();
    return { stats };
  }

  async handleRebuildIndex(): Promise<{ success: boolean }> {
    try {
      await indexer.rebuildIndex();
      return { success: true };
    } catch (error) {
      console.error('Error rebuilding index:', error);
      return { success: false };
    }
  }

  async handleClearAllData(): Promise<{ success: boolean }> {
    try {
      await storage.clearAllData();
      await indexer.clearIndex();
      return { success: true };
    } catch (error) {
      console.error('Error clearing all data:', error);
      return { success: false };
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Chrome extension event listeners
chrome.runtime.onInstalled.addListener(async () => {
  console.log('BrowserMate AI installed');
  await backgroundService.initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('BrowserMate AI startup');
  await backgroundService.initialize();
});

// Handle alarms for periodic sync
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync-browser-data') {
    console.log('Periodic sync triggered');
    await backgroundService.syncBrowserData();
  }
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background: Received message:', message.type, message);
  
  // For GET_SETTINGS, respond immediately
  if (message.type === 'GET_SETTINGS') {
    console.log('Background: Handling GET_SETTINGS immediately');
    
    // Ensure service is initialized, but don't wait for it
    if (!backgroundService.isInitialized) {
      console.log('Background: Service not initialized, starting initialization...');
      backgroundService.initialize().catch(error => {
        console.error('Background: Error during delayed initialization:', error);
      });
      // Mark as initialized to prevent multiple initialization attempts
      backgroundService.isInitialized = true;
    }
    
    // Get settings immediately
    backgroundService.handleGetSettings().then(response => {
      console.log('Background: Sending GET_SETTINGS response:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Background: Error getting settings:', error);
      sendResponse({ error: error.message || 'Failed to get settings' });
    });
    
    return true; // Keep channel open
  }
  
  // Handle other message types with the previous pattern
  (async () => {
    try {
      if (!backgroundService.isInitialized) {
        console.log('Background: Service not initialized, initializing...');
        await backgroundService.initialize();
      }

      console.log('Background: Processing message:', message.type);
      let response;

      switch (message.type) {
        case 'CHAT_REQUEST':
          response = await backgroundService.handleChatRequest(message as ChatRequest);
          console.log('Background: Sending chat response');
          break;

        case 'SYNC_REQUEST':
          response = await backgroundService.handleSyncRequest();
          console.log('Background: Sending sync response');
          break;

        case 'UPDATE_SETTINGS':
          response = await backgroundService.handleUpdateSettings(message.payload);
          console.log('Background: Sending update settings response');
          break;

        case 'GET_STORAGE_STATS':
          response = await backgroundService.handleGetStorageStats();
          console.log('Background: Sending storage stats response');
          break;

        case 'REBUILD_INDEX':
          response = await backgroundService.handleRebuildIndex();
          console.log('Background: Sending rebuild index response');
          break;

        case 'CLEAR_ALL_DATA':
          response = await backgroundService.handleClearAllData();
          console.log('Background: Sending clear all data response');
          break;

        default:
          console.log('Background: Unknown message type:', message.type);
          response = { error: 'Unknown message type' };
      }

      sendResponse(response);
    } catch (error) {
      console.error('Background: Error handling message:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  })();
  
  return true; // Keep the message channel open for async response
});

// Handle long-lived connections for streaming
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'browsermate-chat') {
    port.onMessage.addListener(async (message) => {
      try {
        if (!backgroundService.isInitialized) {
          await backgroundService.initialize();
        }

        if (message.type === 'CHAT_REQUEST') {
          const response = await backgroundService.handleChatRequest(message as ChatRequest);
          port.postMessage(response);
        }
      } catch (error) {
        console.error('Error handling port message:', error);
        port.postMessage({
          type: 'ERROR',
          payload: { message: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    });
  }
});

export default backgroundService; 