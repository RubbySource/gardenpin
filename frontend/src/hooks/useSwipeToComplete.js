// Mobile swipe-to-complete behaviour for task cards.
// Drag right past the threshold and release → calls onComplete.
// Vertical scroll wins if the user moves more vertically than horizontally on the first move.
import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 80;
const SWIPE_MAX = 140;

export function useSwipeToComplete(onComplete) {
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
    setDrag(dx > 0 ? Math.min(dx, SWIPE_MAX) : 0);
  };

  const onTouchEnd = () => {
    if (completing || startX.current == null) {
      reset();
      return;
    }
    if (drag >= SWIPE_THRESHOLD) {
      setCompleting(true);
      setDrag(SWIPE_MAX);
      // Tiny delay so the green confirmation animation is visible
      setTimeout(() => {
        onComplete && onComplete();
      }, 180);
    } else {
      reset();
    }
  };

  const triggered = drag >= SWIPE_THRESHOLD;
  const swiping = drag > 0;
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
    triggered,
  };
}
