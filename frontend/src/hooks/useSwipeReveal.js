// Swipe-to-reveal hook (iOS Mail / Reminders trailing-actions style).
// Drag left exposes a fixed-width action drawer that SNAPS open or closed
// on release (unlike useSwipeActions, which triggers a single action on
// threshold). Used by the gardens list cards (Sdílet / Upravit / Smazat).
//
// `open` is controlled by the parent so only one row stays open at a time.
import { useEffect, useRef, useState } from 'react';

export function useSwipeReveal({ width = 228, open = false, onOpenChange } = {}) {
  const [dx, setDx] = useState(open ? -width : 0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const baseX = useRef(0);
  const horizontal = useRef(false);
  const decided = useRef(false);
  const moved = useRef(false);

  // Sync to controlled open state when not actively dragging.
  useEffect(() => {
    if (startX.current == null) setDx(open ? -width : 0);
  }, [open, width]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    baseX.current = dx;
    horizontal.current = false;
    decided.current = false;
    moved.current = false;
  };

  const onTouchMove = (e) => {
    if (startX.current == null) return;
    const t = e.touches[0];
    const ddx = t.clientX - startX.current;
    const ddy = t.clientY - startY.current;
    if (!decided.current) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      horizontal.current = Math.abs(ddx) > Math.abs(ddy);
      decided.current = true;
      if (!horizontal.current) {
        startX.current = null; // vertical scroll wins — yield
        return;
      }
      setDragging(true);
    }
    moved.current = true;
    // Clamp with a touch of rubber-band past the open edge.
    let next = baseX.current + ddx;
    next = Math.max(-width - 28, Math.min(0, next));
    setDx(next);
  };

  const onTouchEnd = () => {
    if (startX.current == null) {
      setDragging(false);
      return;
    }
    startX.current = null;
    setDragging(false);
    if (!horizontal.current) return;
    const shouldOpen = dx < -width / 2;
    setDx(shouldOpen ? -width : 0);
    onOpenChange?.(shouldOpen);
  };

  // True right after a horizontal swipe so the parent can swallow the
  // click that browsers synthesise on touchend (avoids accidental nav).
  const consumeSwipeClick = () => {
    if (moved.current && horizontal.current) {
      moved.current = false;
      return true;
    }
    return false;
  };

  const style = {
    transform: `translateX(${dx}px)`,
    transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22,1,0.36,1)',
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
    style,
    dx,
    dragging,
    isOpen: dx <= -width / 2,
    consumeSwipeClick,
  };
}
