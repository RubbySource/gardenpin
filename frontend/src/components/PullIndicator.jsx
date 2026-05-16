// iOS-style spinner indicator above the page content when pulling to refresh.
import React from 'react';

export default function PullIndicator({ pull, refreshing, threshold }) {
  const visible = pull > 0 || refreshing;
  const progress = Math.min(1, pull / threshold);
  return (
    <div
      className={`pull-indicator ${refreshing ? 'spinning' : ''}`}
      style={{
        height: pull,
        opacity: visible ? 1 : 0,
      }}
      aria-hidden="true"
    >
      <div
        className="pull-indicator-spinner"
        style={{
          transform: refreshing ? 'rotate(360deg)' : `rotate(${progress * 270}deg)`,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <polyline points="21 4 21 12 13 12" />
        </svg>
      </div>
    </div>
  );
}
