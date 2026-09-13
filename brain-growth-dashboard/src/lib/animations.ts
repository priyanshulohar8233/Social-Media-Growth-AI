"use client";

import { useEffect, useState, useRef } from "react";

export function useAnimatedNumber(target: number, duration: number = 1000) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = current;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(startRef.current + (target - startRef.current) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

export function useStaggeredReveal(count: number, delay: number = 80) {
  const [visible, setVisible] = useState<boolean[]>([]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          setVisible((prev) => [...prev, true]);
        }, i * delay)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [count, delay]);

  return visible;
}
