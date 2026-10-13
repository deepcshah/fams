import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Cheap stable hash, so a card's wobble is the same every time it starts. */
export function seedOf(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The iOS home-screen wobble. The trick is that every card runs at its own
 * period and phase: in lockstep it reads as one object shaking, out of step it
 * reads as a shelf of loose photographs, which is the feeling we want.
 *
 * Returns a static style when the system asks for reduced motion — this is
 * exactly the kind of looping animation that causes trouble, so callers should
 * mark the mode some other way as well.
 */
export function useJiggle(active: boolean, seed: number) {
  const reduced = useReducedMotion();
  const rotate = useSharedValue(0);
  const lift = useSharedValue(0);
  const running = active && !reduced;

  useEffect(() => {
    if (!running) {
      rotate.value = withTiming(0, { duration: 140 });
      lift.value = withTiming(0, { duration: 140 });
      return;
    }
    const period = 112 + (seed % 5) * 11;
    const delay = (seed % 7) * 24;
    rotate.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(-1, { duration: period }), withTiming(1, { duration: period })), -1, true),
    );
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-1, { duration: Math.round(period * 1.37) }),
          withTiming(1, { duration: Math.round(period * 1.37) }),
        ),
        -1,
        true,
      ),
    );
  }, [lift, rotate, running, seed]);

  return useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotate.value * 0.75}deg` }, { translateY: lift.value * 0.9 }],
  }));
}

/** True when the wobble is suppressed, so the UI can say so another way. */
export function useJiggleSuppressed(): boolean {
  return useReducedMotion();
}
