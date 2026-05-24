// Tmavé / světlé téma — iOS-style toggle, ukládání do localStorage
import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'gardenpin.theme';

export function getStoredTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {}
  return 'light';
}

export function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme());
  const isDark = theme === 'dark';

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <div className="theme-toggle-row">
      <div className="theme-toggle-info">
        <div className="theme-toggle-title">
          {isDark ? '🌙' : '☀️'} Tmavý režim
        </div>
        <div className="theme-toggle-sub">
          {isDark ? 'Tmavé téma je aktivní' : 'Aktivuje šetrné tmavé téma'}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Přepnout tmavý režim"
        className={`ios-switch ${isDark ? 'on' : ''}`}
        onClick={toggle}
      >
        <span className="ios-switch-knob" />
      </button>
    </div>
  );
}
