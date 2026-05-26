// Entry point for React app
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { initNative } from './native.js';
import './styles.css';
import './ios-redesign.css';
import './tailwind.css';

// Capacitor native init (no-op na webu)
initNative();

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
