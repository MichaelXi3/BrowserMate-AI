// Content script to bridge communication between popup and background service worker
// This script runs in the context of web pages and helps establish MessagePort connections

interface PortMessage {
  type: string;
  payload?: any;
}

class ChatPortManager {
  private port: chrome.runtime.Port | null = null;
  private isConnected = false;

  constructor() {
    this.setupPortConnection();
  }

  private setupPortConnection(): void {
    try {
      // Connect to background script
      this.port = chrome.runtime.connect({ name: 'browsermate-chat' });
      
      if (this.port) {
        this.isConnected = true;
        
        this.port.onMessage.addListener((message: PortMessage) => {
          // Forward messages to the page if needed
          console.log('Received message from background:', message);
          
          // Send message to popup via window messaging
          window.postMessage({
            source: 'browsermate-content',
            ...message,
          }, '*');
        });

        this.port.onDisconnect.addListener(() => {
          console.log('Chat port disconnected');
          this.isConnected = false;
          this.port = null;
          
          // Attempt to reconnect after a delay
          setTimeout(() => {
            this.setupPortConnection();
          }, 1000);
        });

        console.log('Chat port connected successfully');
      }
    } catch (error) {
      console.error('Error setting up chat port:', error);
      this.isConnected = false;
    }
  }

  sendMessage(message: PortMessage): void {
    if (this.port && this.isConnected) {
      this.port.postMessage(message);
    } else {
      console.warn('Chat port not connected, cannot send message:', message);
      // Try to reconnect
      this.setupPortConnection();
    }
  }

  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
      this.isConnected = false;
    }
  }
}

// Initialize the chat port manager
const chatPortManager = new ChatPortManager();

// Listen for messages from the popup/page
window.addEventListener('message', (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) {
    return;
  }

  // Only handle messages intended for BrowserMate
  if (event.data && event.data.source === 'browsermate-popup') {
    console.log('Forwarding message to background:', event.data);
    chatPortManager.sendMessage(event.data);
  }
});

// Listen for page unload to clean up the connection
window.addEventListener('beforeunload', () => {
  chatPortManager.disconnect();
});

// Expose the chat port manager to the global scope for debugging
(window as any).browsermateChat = chatPortManager;

export default chatPortManager; 