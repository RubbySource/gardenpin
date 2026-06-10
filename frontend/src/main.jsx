// Entry point for React app
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { initNative } from './native.js';
import './i18n.js';
import './styles.css';
import './ios-redesign.css';
import './tailwind.css';

// Capacitor native init (no-op na webu)
initNative();

// PWA service worker — registrace pro offline cache + push (AS-3).
// Push subscribe se řeší zvlášť v push.js; tady jen registrujeme SW, ať ho má prohlížeč k dispozici.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
