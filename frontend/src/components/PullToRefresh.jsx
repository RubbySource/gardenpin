// Wrapper that adds pull-to-refresh behaviour to its children.
import React from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import { IconRefresh } from './Icons.jsx';

export default function PullToRefresh({ onRefresh, children }) {
  const { pull, refreshing, triggered, rotation, handlers } = usePullToRefresh(onRefresh);

  return (
    <div className="ptr-root" {...handlers}>
      <div
        className={`ptr-indicator ${refreshing ? 'refreshing' : ''} ${triggered ? 'triggered' : ''}`}
        style={{
          height: pull,
          opacity: pull > 4 ? Math.min(pull / 60, 1) : 0,
        }}
        aria-hidden="true"
      >
        <span
          className="ptr-icon"
          style={{
            transform: refreshing ? undefined : `rotate(${rotation}deg)`,
          }}
        >
          <IconRefresh size={20} />
        </span>
        <span className="ptr-label">
          {refreshing ? 'Aktualizuji…' : triggered ? 'Pusťte pro obnovení' : 'Tahem dolů obnovit'}
        </span>
      </div>
      <div
        className="ptr-content"
        style={{
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition: pull > 0 && !refreshing ? 'none' : 'transform 0.25s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
