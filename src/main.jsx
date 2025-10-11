// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import useLyricsStore from './context/LyricsStore';

if (typeof window !== 'undefined' && window.electronAPI) {
  try {
    useLyricsStore.getState().setIsDesktopApp(true);
  } catch (error) {
    console.warn('Failed to initialize desktop mode flag:', error);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
