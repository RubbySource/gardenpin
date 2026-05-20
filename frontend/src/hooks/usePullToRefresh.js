// Pull-to-refresh — funguje pouze když je window scrollY === 0.
// onRefresh musí vrátit Promise; během načítání drží spinner viditelný.
import { useEffect, useRef, useState } from 'react';

const TRIGGER = 70;
const MAX_PULL = 120;
const DAMPING = 0.5;

export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [loading, setLoading] = useState(false);
  const startY = useRef(null);
  const armed = useRef(false);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (loading) return;
      if ((window.scrollY || document.documentElement.scrollTop) > 0) {
        armed.current = false;
        return;
      }
      armed.current = true;
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (!armed.current || loading || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const damped = Math.min(dy * DAMPING, MAX_PULL);
      setPull(damped);
    };
    const onTouchEnd = async () => {
      if (!armed.current || loading) {
        setPull(0);
        return;
      }
      armed.current = false;
      if (pull >= TRIGGER) {
        setLoading(true);
        setPull(TRIGGER);
        try {
          await onRefresh?.();
        } finally {
          setLoading(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
      startY.current = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pull, loading, onRefresh]);

  const triggered = pull >= TRIGGER;
  return {
    pull,
    loading,
    triggered,
    indicatorStyle: {
      transform: `translateY(${pull - 40}px)`,
      opacity: pull > 4 ? Math.min(pull / TRIGGER, 1) : 0,
    },
  };
}
