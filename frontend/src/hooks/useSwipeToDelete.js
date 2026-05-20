// iOS-style swipe-to-delete: levý swipe odhalí "Smazat" tlačítko.
// Otevřený stav se zavře kliknutím mimo nebo dalším pohybem doprava.
import { useRef, useState } from 'react';

const REVEAL_THRESHOLD = 50;
const REVEAL_WIDTH = 88;
const FULL_SWIPE_THRESHOLD = 180;

export function useSwipeToDelete(onDelete) {
  const [drag, setDrag] = useState(0); // záporné hodnoty = posunuto vlevo
  const [open, setOpen] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const horizontal = useRef(false);
  const baseline = useRef(0); // počáteční offset při otevřeném stavu

  const reset = () => {
    setDrag(0);
    setOpen(false);
    startX.current = null;
    startY.current = null;
    horizontal.current = false;
    baseline.current = 0;
  };

  const close = () => {
    setDrag(0);
    setOpen(false);
    baseline.current = 0;
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
    baseline.current = open ? -REVEAL_WIDTH : 0;
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
    const next = baseline.current + dx;
    setDrag(Math.max(Math.min(next, 0), -FULL_SWIPE_THRESHOLD - 40));
  };

  const onTouchEnd = () => {
    if (startX.current == null) return;
    if (drag <= -FULL_SWIPE_THRESHOLD) {
      setDrag(-FULL_SWIPE_THRESHOLD - 60);
      setTimeout(() => onDelete && onDelete(), 160);
      return;
    }
    if (drag <= -REVEAL_THRESHOLD) {
      setDrag(-REVEAL_WIDTH);
      setOpen(true);
      baseline.current = -REVEAL_WIDTH;
    } else {
      close();
    }
    startX.current = null;
    horizontal.current = false;
  };

  const itemStyle = {
    transform: `translateX(${drag}px)`,
    transition: startX.current != null ? 'none' : 'transform 0.22s ease',
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    itemStyle,
    isOpen: open,
    close,
    revealWidth: REVEAL_WIDTH,
  };
}
