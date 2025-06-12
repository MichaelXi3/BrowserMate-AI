import React from 'react';
import ReactDOM from 'react-dom/client';
import Options from './Options.tsx';
import '../popup/index.css'; // Reuse styles

const root = ReactDOM.createRoot(
  document.getElementById('options-root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
); 