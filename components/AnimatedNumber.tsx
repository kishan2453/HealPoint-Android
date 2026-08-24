/**
 * HealPoint - AnimatedNumber.
 *
 * A dependency-light count-up number with an ease-out curve. Runs a
 * requestAnimationFrame loop on the JS thread (no worklets needed for a plain
 * number), so it is rock-solid on both native and web while still feeling
 * premium. Used by the Wellness dashboard for its big score.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  /** Animation duration in ms. Default 1100. */
  duration?: number;
  style?: StyleProp<TextStyle>;
  formatter?: (value: number) => string;
}

/** Ease-out cubic easing for a smooth, natural "landing" feel. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({
  value,
  duration = 1100,
  style,
  formatter = (v) => String(v),
}: AnimatedNumberProps) {
  const [text, setText] = useState(formatter(0));
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (value === from) {
      setText(formatter(value));
      return;
    }

    const perf = (global as { performance?: Performance }).performance;
    const start = perf ? perf.now() : Date.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const current = Math.round(from + (value - from) * eased);
      setText(formatter(current));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <Text style={style}>{text}</Text>;
}