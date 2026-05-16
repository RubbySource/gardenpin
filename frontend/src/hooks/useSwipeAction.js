// Two-way swipe gesture (iOS-style).
// Drag left past threshold → onSwipeLeft (typicky delete).
// Drag right past threshold → onSwipeRight (typicky complete).
// Vertikální scroll vyhraje, pokud uživatel táhne víc nahoru/dolů než do strany.
import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 80;
const SWIPE_MAX = 140;

export function useSwipeAction({ onSwipeLeft, onSwipeRight } = {}) {
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
    const allowRight = !!onSwipeRight;
    const allowLeft = !!onSwipeLeft;
    let next = dx;
    if (next > 0 && !allowRight) next = 0;
    if (next < 0 && !allowLeft) next = 0;
    if (next > SWIPE_MAX) next = SWIPE_MAX;
    if (next < -SWIPE_MAX) next = -SWIPE_MAX;
    setDrag(next);
  };

  const onTouchEnd = () => {
    if (completing || startX.current == null) {
      reset();
      return;
    }
    if (drag >= SWIPE_THRESHOLD && onSwipeRight) {
      setCompleting(true);
      setDrag(SWIPE_MAX);
      setTimeout(() => onSwipeRight(), 180);
    } else if (drag <= -SWIPE_THRESHOLD && onSwipeLeft) {
      setCompleting(true);
      setDrag(-SWIPE_MAX);
      setTimeout(() => onSwipeLeft(), 180);
    } else {
      reset();
    }
  };

  const triggeredRight = drag >= SWIPE_THRESHOLD;
  const triggeredLeft = drag <= -SWIPE_THRESHOLD;
  const swiping = drag !== 0;
  const itemStyle = {
    transform: `translateX(${drag}px)`,
    transition: swiping && !completing ? 'none' : 'transform 0.25s ease',
  };

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
    itemStyle,
    swiping,
    triggeredRight,
    triggeredLeft,
    drag,
  };
}
