"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

const R = 50 - 4; // viewBox 100, padding for stroke

/** Circular progress with spring animation and gradient stroke. */
export function ProgressRing({
  value,
  size = 80,
  stroke = 8,
}: {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const offset = useTransform(spring, (v) => 2 * Math.PI * R * (1 - Math.min(1, Math.max(0, v))));
  const prev = useRef(0);

  useEffect(() => {
    mv.set(value);
    prev.current = value;
  }, [value, mv]);

  const pct = useTransform(spring, (v) => `${Math.round(v * 100)}%`);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth={stroke} className="stroke-line" />
        <motion.circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * R}
          style={{ strokeDashoffset: offset }}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-500)" />
            <stop offset="100%" stopColor="var(--amber-500)" />
          </linearGradient>
        </defs>
      </svg>
      <motion.span className="tabular absolute inset-0 flex items-center justify-center text-sm font-bold">
        {pct}
      </motion.span>
    </div>
  );
}
