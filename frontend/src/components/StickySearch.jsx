// iOS-style sticky search bar with blur backdrop + SF-symbol-inspired magnifier
import React from 'react';

export default function StickySearch({ value, onChange, placeholder = 'Hledat…' }) {
  return (
    <div className="ios-search-wrap">
      <div className="ios-search">
        <svg
          className="ios-search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck="false"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {value && (
          <button
            type="button"
            className="ios-search-clear"
            onClick={() => onChange('')}
            aria-label="Vymazat"
            title="Vymazat"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
