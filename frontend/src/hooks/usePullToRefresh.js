// iOS-style pull-to-refresh.
// Funguje, jen když je document scroll na samém vrchu.
// Vrací pullDistance (0–PULL_MAX) a refreshing boolean pro UI indikátor.
import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD = 70;
const PULL_MAX = 110;

export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const active = useRef(false);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (refreshing) return;
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };
    const onTouchMove = (e) => {
      if (!active.current || startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const resisted = Math.min(PULL_MAX, dy * 0.55);
      setPull(resisted);
    };
    const onTouchEnd = async () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      if (pull >= PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  return { pull, refreshing, threshold: PULL_THRESHOLD };
}
