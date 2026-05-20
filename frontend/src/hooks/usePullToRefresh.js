// Pull-to-refresh hook for mobile lists.
// Drag down from the top while window scrollY is 0 → calls onRefresh.
// Returns { pull, refreshing, handlers } — apply handlers to a top-level element.
import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 110;

export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const active = useRef(false);

  const reset = () => {
    setPull(0);
    startY.current = null;
    active.current = false;
  };

  useEffect(() => {
    if (!refreshing) return;
    let cancelled = false;
    (async () => {
      try {
        await onRefresh?.();
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          reset();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshing, onRefresh]);

  const onTouchStart = (e) => {
    if (refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };

  const onTouchMove = (e) => {
    if (!active.current || refreshing || startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Damped pull, capped at MAX_PULL
    const next = Math.min(dy * 0.55, MAX_PULL);
    setPull(next);
  };

  const onTouchEnd = () => {
    if (!active.current) return;
    if (pull >= THRESHOLD) {
      setPull(THRESHOLD);
      setRefreshing(true);
    } else {
      reset();
    }
  };

  const triggered = pull >= THRESHOLD;
  const rotation = Math.min((pull / THRESHOLD) * 360, 360);

  return {
    pull,
    refreshing,
    triggered,
    rotation,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
  };
}
