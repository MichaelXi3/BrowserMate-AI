# BrowserMate AI

**A plug-and-play Chrome extension that lets users chat with their Bookmarks, Browsing History, and Reading List using AI.**

BrowserMate AI is a Manifest v3 Chrome extension built with React, TypeScript, and Vite. It stores browser data locally, indexes it for fast search, and provides a chat interface powered by OpenAI's GPT-4o API. Ask natural-language questions like "Show me articles I saved about Rust last month" or "What was that tutorial I read on async await yesterday?"

## Features

- **Smart Search**: Full-text search across bookmarks, browsing history, and reading list
- **AI Chat Interface**: Natural language queries powered by OpenAI GPT-4o
- **Privacy First**: All data stored locally, minimal context sent to OpenAI
- **Fast Performance**: FlexSearch-powered indexing for instant results
- **Dark Mode**: Automatic dark/light theme based on system preference
- **Auto Sync**: Periodic sync every 30 minutes to keep data fresh
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Prerequisites

- Chrome browser (Manifest v3 support)
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
- Node.js 16+ and npm for development

## Installation & Setup

### Option 1: Load Unpacked (Development)

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/browsermate-ai.git
   cd browsermate-ai
````

2. Install dependencies

   ```bash
   npm install
   ```

3. Build the extension

   ```bash
   npm run build
   ```

4. Load in Chrome

   * Open Chrome and go to `chrome://extensions/`
   * Enable "Developer mode" in the top right
   * Click "Load unpacked" and select the `dist` folder
   * The BrowserMate AI icon should appear in your toolbar

### Option 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once published.

## Configuration

1. Set up OpenAI API Key

   * Click the BrowserMate AI icon in your toolbar
   * Click the settings icon
   * Enter your OpenAI API key in the configuration field
   * Click "Save Settings"

2. Configure Data Sources

   * In the popup, toggle the source filters (Bookmarks/History/Reading List)
   * The extension will automatically sync your data

3. Initial Sync

   * The extension automatically syncs your browser data
   * You can manually trigger a sync using the "Sync" button

## Usage

### Chat Interface

1. Start Chatting

   * Click the BrowserMate AI icon to open the popup
   * Type your question in the chat input
   * Press Enter or click the send button

2. Example Queries

   ```
   Show me articles about React from last month
   What tutorials did I bookmark about Python?
   Find that blog post I read yesterday about machine learning
   Show me all my bookmarks about web development
   What GitHub repositories did I visit this week?
   ```

3. View Sources

   * AI responses include relevant source links
   * Click on source links to open the original pages

### Settings & Management

1. Options Page

   * Right-click the extension icon → "Options"
   * Or click the settings icon in the popup

2. Data Management

   * View storage usage statistics
   * Rebuild search index if needed
   * Clear all data (with confirmation)

3. Privacy Settings

   * Toggle data sources on/off
   * View what data is shared with OpenAI

## Privacy & Security

### What Data Stays Local

* Complete browsing history
* All bookmark content and metadata
* Reading list items
* Chat conversation history
* OpenAI API key (stored securely)

### What Gets Sent to OpenAI

* Only minimal context: Title, URL, and short snippet of relevant results
* User query: Your chat message
* No raw browsing data: Full page content, personal info, or complete history

### Security Features

* All data encrypted in Chrome's local storage
* API key stored securely and never logged
* No data transmission to third parties except OpenAI
* HTTPS-only communication with OpenAI API

## Development

### Project Structure

```
browsermate-ai/
├── public/                 # Static assets and icons
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content scripts
│   ├── popup/             # React popup app
│   ├── options/           # Settings page
│   ├── lib/               # Core utilities
│   ├── types/             # TypeScript definitions
│   └── __tests__/         # Unit tests
├── manifest.json          # Extension manifest
└── vite.config.ts         # Build configuration
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Format code
npm run format
```

### Building for Production

1. Build the extension

   ```bash
   npm run build
   ```

2. Package for distribution

   ```bash
   cd dist
   zip -r browsermate-ai.zip .
   ```

3. Verify build size

   * Built extension should be ≤ 2MB zipped
   * Check `dist` folder for generated files

## Testing

### Unit Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

### Manual Testing

1. Load the unpacked extension in Chrome
2. Test basic functionality:

   * Sync browser data
   * Chat with different queries
   * Toggle source filters
   * Configure API key

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

* Use TypeScript strict mode
* Follow ESLint and Prettier configurations
* Write unit tests for new features
* Update documentation as needed

## Technical Details

### Architecture

* Frontend: React 18 + TypeScript + Vite
* Styling: Tailwind CSS with dark mode support
* Search: FlexSearch for fast full-text indexing
* AI: OpenAI GPT-4o API integration
* Storage: Chrome Extension APIs (local storage)
* Testing: Vitest + jsdom

### Performance

* Lazy loading of components
* Efficient search indexing with FlexSearch
* Rate limiting for OpenAI API calls
* Optimized bundle size with Vite

### Browser Compatibility

* Chrome 88+ (Manifest v3 support)
* Edge 88+ (Chromium-based)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Issues & Support

* Bug Reports: [GitHub Issues](https://github.com/yourusername/browsermate-ai/issues)
* Feature Requests: [GitHub Discussions](https://github.com/yourusername/browsermate-ai/discussions)
* Documentation: [Wiki](https://github.com/yourusername/browsermate-ai/wiki)

## Roadmap

* [ ] Support for additional AI providers (Anthropic, Gemini)
* [ ] Cross-device sync via Chrome storage sync
* [ ] Advanced search filters and sorting
* [ ] Export/import functionality
* [ ] Custom AI prompts and templates
* [ ] Performance analytics and insights

---

**Important**: This extension requires an OpenAI API key and makes API calls that may incur costs. Please review OpenAI's pricing at [openai.com/pricing](https://openai.com/pricing) before use.

**Privacy**: Your browsing data never leaves your device except for minimal context sent to OpenAI for generating responses. Review the privacy section above for full details.