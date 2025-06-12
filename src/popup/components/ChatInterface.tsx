import React, { useState, useRef, useEffect } from 'react';
import type { ChatSession, AppSettings } from '@/types/models';

interface ChatInterfaceProps {
  currentSession: ChatSession | null;
  onSessionChange: (session: ChatSession | null) => void;
  settings: AppSettings;
  onShowSnackbar: (message: string, type?: 'error' | 'success' | 'info') => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  currentSession,
  onSessionChange,
  onShowSnackbar,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const query = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Send chat request to background
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_REQUEST',
        payload: {
          query,
          sessionId: currentSession?.id,
        },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Update session with response
      if (response.type === 'CHAT_RESPONSE') {
        const { message, sessionId } = response.payload;
        
        // If this is a new session, create it
        if (!currentSession || currentSession.id !== sessionId) {
          const newSession: ChatSession = {
            id: sessionId,
            messages: [
              {
                id: crypto.randomUUID(),
                content: query,
                timestamp: Date.now(),
                type: 'user',
              },
              message,
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          onSessionChange(newSession);
        } else {
          // Update existing session
          const updatedSession = {
            ...currentSession,
            messages: [
              ...currentSession.messages,
              {
                id: crypto.randomUUID(),
                content: query,
                timestamp: Date.now(),
                type: 'user' as const,
              },
              message,
            ],
            updatedAt: Date.now(),
          };
          onSessionChange(updatedSession);
        }
      }
    } catch (error) {
      console.error('Error sending chat request:', error);
      onShowSnackbar('Failed to send message. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">$1</a>');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {!currentSession?.messages.length ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="max-w-md mx-auto px-4">
              <div className="w-20 h-20 mx-auto mb-6 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-3">
                Start a conversation
              </h3>
              <p className="text-base text-gray-600 dark:text-gray-400 mb-4">
                Ask me about your bookmarks, browsing history, or reading list. For example:
              </p>
              <div className="space-y-2 text-sm text-gray-500 dark:text-gray-500">
                <p className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">"Show me articles about React from last month"</p>
                <p className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">"What tutorials did I bookmark about Python?"</p>
                <p className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">"Find that blog post I read yesterday"</p>
              </div>
            </div>
          </div>
        ) : (
          currentSession.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div
                  className="text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                />
                
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Sources:</p>
                    <div className="space-y-1">
                      {message.sources.slice(0, 3).map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
                          title={source.title}
                        >
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 bg-gray-900">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your bookmarks, history, or reading list..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface; 