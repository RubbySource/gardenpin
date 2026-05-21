// Pull-to-refresh for touch devices. Activates only when the page is scrolled to the top.
// Returns pullDistance (px) and triggered flag so the caller can render an indicator.
import { useRef, useState, useCallback } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 110;
const DAMPING = 0.55;

export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const active = useRef(false);

  const onTouchStart = useCallback((e) => {
    if (refreshing) return;
    if ((window.scrollY || document.documentElement.scrollTop) > 0) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  }, [refreshing]);

  const onTouchMove = useCallback((e) => {
    if (!active.current || startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      if (pull !== 0) setPull(0);
      return;
    }
    setPull(Math.min(dy * DAMPING, MAX_PULL));
  }, [pull]);

  const onTouchEnd = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, refreshing, onRefresh]);

  const triggered = pull >= THRESHOLD;
  const handlers = { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };

  return { pull, triggered, refreshing, handlers };
}
