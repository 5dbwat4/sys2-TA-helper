"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useTransform, motion } from "motion/react";

/** Number that springs to its new value. */
export function AnimatedNumber({
  value,
  className,
  format = (v: number) => String(Math.round(v * 10) / 10),
}: {
  value: number;
  className?: string;
  format?: (v: number) => string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  const prev = useRef(0);

  useEffect(() => {
    const controls = animate(mv, value, {
      type: "spring",
      stiffness: 120,
      damping: 22,
      from: prev.current,
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
