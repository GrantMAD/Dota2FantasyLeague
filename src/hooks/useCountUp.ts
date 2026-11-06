'use client';

import { useEffect, useMemo, useState } from 'react';

interface ParsedNumber {
  prefix: string;
  value: number;
  decimals: number;
  suffix: string;
}

export function parseFormattedNumber(input: string | number): ParsedNumber | null {
  if (typeof input === 'number') {
    if (Number.isNaN(input)) return null;
    const isInteger = Number.isInteger(input);
    const decimals = isInteger ? 0 : (input.toString().split('.')[1]?.length ?? 2);
    return {
      prefix: '',
      value: input,
      decimals,
      suffix: '',
    };
  }

  const str = String(input).trim();
  if (!str) return null;

  // Match optional prefix, numeric part (with optional decimals), and optional suffix
  const match = str.match(/^([^\d\-+.]*?)([+-]?(?:\d+(?:\.\d+)?|\.\d+))(.*)$/);
  if (!match) return null;

  const prefix = match[1] || '';
  const numStr = match[2];
  const suffix = match[3] || '';

  const value = parseFloat(numStr);
  if (Number.isNaN(value)) return null;

  const decimalPart = numStr.split('.')[1];
  const decimals = decimalPart ? decimalPart.length : 0;

  return {
    prefix,
    value,
    decimals,
    suffix,
  };
}

export function useCountUp(target: string | number, duration = 1600): string | number {
  const parsed = useMemo(() => parseFormattedNumber(target), [target]);

  const [animatedValue, setAnimatedValue] = useState<string | number>(() => {
    if (!parsed) return target;
    const initialNum = parsed.decimals > 0 ? (0).toFixed(parsed.decimals) : '0';
    return `${parsed.prefix}${initialNum}${parsed.suffix}`;
  });

  useEffect(() => {
    // If non-numeric, no animation loop needed
    if (!parsed) {
      return;
    }

    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      return;
    }

    let animationFrameId: number;
    let startTime: number | null = null;
    const startVal = 0;
    const endVal = parsed.value;

    // Smoother ease-out quart curve
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);

      if (progress < 1) {
        const currentVal = startVal + (endVal - startVal) * eased;
        const formattedNumber =
          parsed.decimals > 0 ? currentVal.toFixed(parsed.decimals) : Math.round(currentVal).toString();

        setAnimatedValue(`${parsed.prefix}${formattedNumber}${parsed.suffix}`);
        animationFrameId = requestAnimationFrame(step);
      } else {
        // Ensure final exact value is reached
        setAnimatedValue(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [target, duration, parsed]);

  // If non-numeric or reduced motion, directly return the target value without waiting for state
  if (!parsed) return target;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  ) {
    return target;
  }

  return animatedValue;
}

