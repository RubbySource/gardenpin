// iOS-style pull-to-refresh circular indicator
import React from 'react';

export default function PullRefreshIndicator({ style, progress, refreshing, triggered }) {
  const angle = Math.min(360, progress * 360);
  return (
    <div className="ptr-indicator" style={style} aria-hidden="true">
      <div className={`ptr-spinner ${refreshing ? 'spinning' : ''} ${triggered ? 'triggered' : ''}`}>
        {refreshing ? (
          <span className="ptr-dot" />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeDasharray={`${(angle / 360) * 56.5} 56.5`}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
