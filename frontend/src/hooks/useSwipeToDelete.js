// Swipe-to-delete: drag LEFT past the threshold and release → calls onDelete.
// Mirror of useSwipeToComplete but in the negative direction. Vertical scroll wins
// if the user moves more vertically than horizontally on the first move.
import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 90;
const SWIPE_MAX = 160;

export function useSwipeToDelete(onDelete) {
  const [drag, setDrag] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const horizontal = useRef(false);

  const reset = () => {
    setDrag(0);
    setConfirming(false);
    startX.current = null;
    startY.current = null;
    horizontal.current = false;
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
  };

  const onTouchMove = (e) => {
    if (startX.current == null) return;
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
    // Only negative (left) drag.
    setDrag(dx < 0 ? Math.max(dx, -SWIPE_MAX) : 0);
  };

  const onTouchEnd = () => {
    if (startX.current == null) {
      reset();
      return;
    }
    if (Math.abs(drag) >= SWIPE_THRESHOLD) {
      setConfirming(true);
      setDrag(-SWIPE_MAX);
      setTimeout(() => {
        onDelete && onDelete();
        reset();
      }, 180);
    } else {
      reset();
    }
  };

  const triggered = Math.abs(drag) >= SWIPE_THRESHOLD;
  const itemStyle = {
    transform: `translateX(${drag}px)`,
    transition: drag !== 0 && !confirming ? 'none' : 'transform 0.25s ease',
  };

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
    itemStyle,
    triggered,
    confirming,
  };
}
