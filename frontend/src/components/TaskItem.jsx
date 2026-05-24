// Task list item with complete button
import React from 'react';
import { dueBadge, taskIcon, taskLabel } from '../utils.js';
import SnoozeButton from './SnoozeButton.jsx';

export default function TaskItem({ task, onComplete, onClick, showGarden, onSnoozed }) {
  const badge = dueBadge(task.next_due);
  const cls = badge ? badge.cls : '';
  return (
    <div className={`task-item ${cls}`}>
      <button
        className="task-complete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onComplete && onComplete(task);
        }}
        aria-label="Označit jako hotové"
        title="Označit jako hotové"
      >
        ✓
      </button>
      <div className="info" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
        <div className="title">
          {taskIcon(task.task_type)} {task.title}
          {task.recurring ? (
            <span title="Opakuje se každý rok" style={{ marginLeft: 6 }}>🔄</span>
          ) : null}
        </div>
        <div className="meta">
          {task.pin_name}
          {task.plant_name ? ` · ${task.plant_name}` : ''}
          {showGarden && task.garden_name ? ` · 🗺️ ${task.garden_name}` : ''}
        </div>
        <div className="meta mt-2">
          {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
          {task.frequency_days ? (
            <span className="badge" style={{ marginLeft: 6 }}>
              Každých {task.frequency_days} dní
            </span>
          ) : null}
          {task.specific_date && task.recurring && task.recurrence_pattern === 'yearly' ? (
            <span className="badge" style={{ marginLeft: 6 }}>
              🔄 Každý rok
            </span>
          ) : task.specific_date ? (
            <span className="badge" style={{ marginLeft: 6 }}>
              Jednorázově
            </span>
          ) : null}
          <span className="badge type" style={{ marginLeft: 6 }}>
            {taskLabel(task.task_type)}
          </span>
        </div>
      </div>
      {onSnoozed && (task.next_due || task.specific_date) && (
        <SnoozeButton task={task} onSnoozed={onSnoozed} />
      )}
    </div>
  );
}
