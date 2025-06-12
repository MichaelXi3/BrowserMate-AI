export interface BookmarkItem {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  parentId?: string;
  index?: number;
  children?: BookmarkTreeNode[];
}

export interface HistoryItem {
  id: string;
  url?: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
}

export interface ReadingListItem {
  title: string;
  url: string;
  hasBeenRead: boolean;
  creationTime: number;
  lastUpdateTime: number;
}

export interface IndexedItem {
  id: string;
  title: string;
  url: string;
  content: string;
  type: 'bookmark' | 'history' | 'reading-list';
  timestamp: number;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: number;
  type: 'user' | 'assistant' | 'system';
  sources?: IndexedItem[];
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  openaiApiKey?: string;
  enabledSources: {
    bookmarks: boolean;
    history: boolean;
    readingList: boolean;
  };
  maxResults: number;
  syncInterval: number; // in minutes
}

export interface SearchResult {
  item: IndexedItem;
  score: number;
  relevance: number;
}

export interface RAGContext {
  query: string;
  results: SearchResult[];
  timestamp: number;
}

export interface StorageData {
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  readingList: ReadingListItem[];
  indexedItems: IndexedItem[];
  chatSessions: ChatSession[];
  settings: AppSettings;
  lastSyncTime: number;
}

// Message types for communication between components
export interface ExtensionMessage {
  type: string;
  payload?: any;
}

export interface ChatRequest extends ExtensionMessage {
  type: 'CHAT_REQUEST';
  payload: {
    query: string;
    sessionId?: string;
  };
}

export interface ChatResponse extends ExtensionMessage {
  type: 'CHAT_RESPONSE';
  payload: {
    message: ChatMessage;
    sessionId: string;
  };
}

export interface SyncRequest extends ExtensionMessage {
  type: 'SYNC_REQUEST';
}

export interface SyncResponse extends ExtensionMessage {
  type: 'SYNC_RESPONSE';
  payload: {
    success: boolean;
    itemsCount: number;
    lastSyncTime: number;
  };
}

export type MessageType = ChatRequest | ChatResponse | SyncRequest | SyncResponse; 