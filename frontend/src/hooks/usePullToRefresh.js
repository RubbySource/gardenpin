// iOS-style pull-to-refresh. Attach handlers to the page root, only triggers
// when the document scrollY is 0 and the user starts dragging downward.
import { useRef, useState } from 'react';

const TRIGGER = 70;   // px to trigger refresh
const MAX = 110;      // visual clamp

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
    // Resistance: log-ish curve
    const eased = Math.min(MAX, Math.sqrt(dy) * 9);
    setPull(eased);
  };

  const onTouchEnd = async () => {
    if (!active.current) {
      reset();
      return;
    }
    if (pull >= TRIGGER && !refreshing) {
      setRefreshing(true);
      setPull(TRIGGER);
      try {
        await Promise.resolve(onRefresh && onRefresh());
      } catch {
        // ignore
      } finally {
        setRefreshing(false);
        reset();
      }
    } else {
      reset();
    }
  };

  const progress = Math.min(1, pull / TRIGGER);
  const indicatorStyle = {
    transform: `translateY(${refreshing ? TRIGGER : pull}px)`,
    opacity: pull > 0 || refreshing ? 1 : 0,
    transition: active.current ? 'none' : 'transform 0.25s ease, opacity 0.25s',
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
    indicatorStyle,
    pull,
    progress,
    refreshing,
    triggered: pull >= TRIGGER,
  };
}
