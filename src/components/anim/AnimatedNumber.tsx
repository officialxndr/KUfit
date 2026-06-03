import { useEffect, useRef, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import { type } from '@/theme/text';
import { DURATION } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';

/**
 * A number that rolls/counts to its new value instead of snapping. Driven on the
 * JS thread (requestAnimationFrame) so it can render arbitrary formatted text;
 * cheap enough for the handful of headline stats we use it on. Honors
 * `useMotion()` — with motion off it renders the value immediately.
 */
export function AnimatedNumber({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = DURATION.slow,
  variant = 'display',
  style,
  /** Count up from 0 on first mount (nice for calories/volume; odd for weight). */
  animateOnMount = false,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  variant?: keyof typeof type;
  style?: TextStyle | TextStyle[];
  animateOnMount?: boolean;
}) {
  const { animate } = useMotion();
  const [display, setDisplay] = useState(animate && animateOnMount ? 0 : value);
  const fromRef = useRef(animate && animateOnMount ? 0 : value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animate, duration]);

  return <Text style={[type[variant], style]}>{format(display)}</Text>;
}
