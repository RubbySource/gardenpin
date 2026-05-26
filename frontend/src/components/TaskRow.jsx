// Swipovatelný řádek úkolu (iOS Reminders styl) — náhrada za smazaný TaskItem.jsx.
// Akce: swipe vpravo = hotovo (zelená), swipe vlevo = smazat (červená),
// trailing tlačítko = odložit (action-sheet). Tap na obsah otevře detail místa.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import SnoozeButton from './SnoozeButton.jsx';
import FrostWarning from './FrostWarning.jsx';
import SeasonWindowWarning from './SeasonWindowWarning.jsx';
import { useSwipeActions } from '../hooks/useSwipeActions.js';
import { dueBadge, taskLabel, taskIconName } from '../utils.js';

export default function TaskRow({
  task,
  completing,
  deleting,
  forecast,
  onComplete,
  onDelete,
  onOpen,
  onSnoozed,
}) {
  const { t } = useTranslation();
  const { handlers, itemStyle, triggeredLeft, triggeredRight, drag, swiping } = useSwipeActions({
    onSwipeRight: () => onComplete?.(),
    onSwipeLeft: () => onDelete?.(),
  });
  const badge = dueBadge(task.next_due);
  const cls = badge ? badge.cls : '';
  const iconName = taskIconName(task.task_type);
  const overlayDir = drag < 0 ? 'left' : drag > 0 ? 'right' : '';
  const canSnooze = task.next_due || task.specific_date;

  return (
    <div className="task-swipe-cell">
      <div className="swipe-row-wrap">
        <div
          className={`swipe-action-bg swipe-action-complete ${triggeredRight ? 'triggered' : ''}`}
          style={{ opacity: drag > 0 ? 1 : 0 }}
          aria-hidden="true"
        >
          <Icon name="check" size={22} />
          <span>{triggeredRight ? t('common.done') : t('taskRow.swipeComplete')}</span>
        </div>
        <div
          className={`swipe-action-bg swipe-action-delete ${triggeredLeft ? 'triggered' : ''}`}
          style={{ opacity: drag < 0 ? 1 : 0 }}
          aria-hidden="true"
        >
          <Icon name="trash" size={22} />
          <span>{triggeredLeft ? t('common.delete') : t('taskRow.swipeDelete')}</span>
        </div>
        <div
          className={`task-row ios-task-row ${cls} ${canSnooze ? 'has-trailing' : ''} ${completing ? 'completing' : ''} ${deleting ? 'deleting' : ''} swipe-${overlayDir}`}
          style={itemStyle}
          {...handlers}
        >
          <button
            className={`task-checkbox ${completing ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            aria-label={t('taskRow.markDone')}
            title={t('taskRow.markDone')}
          >
            {completing ? <Icon name="check" size={14} stroke={2.5} /> : ''}
          </button>
          <div className="task-row-info" onClick={onOpen} style={{ cursor: 'pointer' }}>
            <div className="task-row-title">
              <span className="task-row-icon-svg" aria-hidden="true">
                <Icon name={iconName} size={16} />
              </span>
              <span className="task-row-name">{task.title}</span>
            </div>
            <div className="task-row-meta">
              {task.pin_name}
              {task.plant_name ? ` · ${task.plant_name}` : ''}
              {task.garden_name ? ` · ${task.garden_name}` : ''}
            </div>
            <div className="task-row-tags">
              {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
              {task.frequency_days ? (
                <span className="badge">{t('taskRow.everyDays', { count: task.frequency_days })}</span>
              ) : null}
              {task.specific_date ? <span className="badge">{t('taskRow.once')}</span> : null}
              <span className="badge type">{taskLabel(task.task_type)}</span>
              {task.assignee_name && (
                <span className="badge assignee" style={{ '--assignee-color': task.assignee_color || '#7BA889' }}>
                  👤 {task.assignee_name}
                </span>
              )}
            </div>
            <FrostWarning task={task} forecast={forecast} onPostponed={onSnoozed} />
            <SeasonWindowWarning task={task} onResolved={onSnoozed} />
          </div>
        </div>
      </div>
      {canSnooze && (
        <div
          className="task-snooze-layer"
          style={{ opacity: swiping ? 0 : 1, pointerEvents: swiping ? 'none' : 'auto' }}
        >
          <SnoozeButton task={task} onSnoozed={onSnoozed} sheet />
        </div>
      )}
    </div>
  );
}
