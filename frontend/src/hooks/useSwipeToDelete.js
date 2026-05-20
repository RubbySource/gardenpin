// Mobile swipe-LEFT-to-delete for list rows.
// Drag left past threshold and release → calls onDelete.
// Vertical scroll wins if user moves vertically more than horizontally on the first move.
import { useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX = 140;

export function useSwipeToDelete(onDelete) {
  const [drag, setDrag] = useState(0); // negative number while dragging left
  const [deleting, setDeleting] = useState(false);
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
    if (deleting) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
  };

  const onTouchMove = (e) => {
    if (deleting || startX.current == null) return;
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
    setDrag(dx < 0 ? Math.max(dx, -MAX) : 0);
  };

  const onTouchEnd = () => {
    if (deleting || startX.current == null) {
      reset();
      return;
    }
    if (Math.abs(drag) >= THRESHOLD) {
      setDeleting(true);
      setDrag(-MAX);
      setTimeout(() => {
        onDelete && onDelete();
      }, 180);
    } else {
      reset();
    }
  };

  const triggered = Math.abs(drag) >= THRESHOLD;
  const swiping = drag < 0;
  const itemStyle = {
    transform: `translateX(${drag}px)`,
    transition: swiping && !deleting ? 'none' : 'transform 0.25s ease',
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
