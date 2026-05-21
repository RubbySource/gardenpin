// Generic horizontal swipe-to-action hook (iOS Mail style).
// Drag left past threshold → calls onSwipeLeft (e.g. delete).
// Drag right past threshold → calls onSwipeRight (e.g. complete).
// Vertical scroll wins on first move if dy > dx.
import { useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX = 140;

export function useSwipeActions({ onSwipeLeft, onSwipeRight } = {}) {
  const [drag, setDrag] = useState(0);
  const [completing, setCompleting] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const horizontal = useRef(false);

  const reset = () => {
    setDrag(0);
    startX.current = null;
    startY.current = null;
    horizontal.current = false;
  };

  const onTouchStart = (e) => {
    if (completing) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
  };

  const onTouchMove = (e) => {
    if (completing || startX.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!horizontal.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      horizontal.current = Math.abs(dx) > Math.abs(dy);
      if (!horizontal.current) {
        startX.current = null;
        return;
      }
    }
    let next = dx;
    if (next > 0 && !onSwipeRight) next = 0;
    if (next < 0 && !onSwipeLeft) next = 0;
    next = Math.max(-MAX, Math.min(MAX, next));
    setDrag(next);
  };

  const onTouchEnd = () => {
    if (completing || startX.current == null) {
      reset();
      return;
    }
    if (drag >= THRESHOLD && onSwipeRight) {
      setCompleting(true);
      setDrag(MAX);
      setTimeout(() => onSwipeRight?.(), 180);
    } else if (drag <= -THRESHOLD && onSwipeLeft) {
      setCompleting(true);
      setDrag(-MAX);
      setTimeout(() => onSwipeLeft?.(), 180);
    } else {
      reset();
    }
  };

  const triggeredRight = drag >= THRESHOLD;
  const triggeredLeft = drag <= -THRESHOLD;
  const swiping = drag !== 0;
  const itemStyle = {
    transform: `translateX(${drag}px)`,
    transition: swiping && !completing ? 'none' : 'transform 0.25s ease',
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    itemStyle,
    drag,
    swiping,
    triggeredRight,
    triggeredLeft,
    completing,
  };
}
