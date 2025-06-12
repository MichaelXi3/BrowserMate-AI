import { createRoot } from 'react-dom/client';
import ChatApp from './ChatApp';
import '../popup/index.css';

const container = document.getElementById('chat-root');
if (container) {
  const root = createRoot(container);
  root.render(<ChatApp />);
} else {
  console.error('Chat root element not found');
} 