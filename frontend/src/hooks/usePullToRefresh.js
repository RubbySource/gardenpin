// Pull-to-refresh: drag down past threshold while at scroll top, release to refresh.
// Touch-only (mobile). Returns transform for indicator + handlers to bind to root.
import { useRef, useState } from 'react';

const PULL_THRESHOLD = 70;
const PULL_MAX = 110;

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

  const onTouchStart = (e) => {
    if (refreshing) return;
    // Only enable when scrolled to top
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
    // Dampen drag
    const damped = Math.min(dy * 0.55, PULL_MAX);
    setPull(damped);
  };

  const onTouchEnd = async () => {
    if (!active.current) {
      reset();
      return;
    }
    if (pull >= PULL_THRESHOLD) {
      setRefreshing(true);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        reset();
      }
    } else {
      reset();
    }
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    pull,
    refreshing,
    triggered: pull >= PULL_THRESHOLD,
  };
}
