// Entry point for React app
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import SharedGardenPage from './pages/SharedGardenPage.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      {/* Veřejný read-only pohled — mimo App shell (žádná spodní navigace) */}
      <Route path="/sdileni/:token" element={<SharedGardenPage />} />
      {/* Hlavní aplikace */}
      <Route path="/*" element={<App />} />
    </Routes>
  </BrowserRouter>,
);
