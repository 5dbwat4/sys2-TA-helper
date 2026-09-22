"use client";

import { useEffect, useState } from "react";

export type CheckoffMode = "single" | "multi";
const KEY = "checkoff-mode";

export function useCheckoffMode(): [CheckoffMode, (m: CheckoffMode) => void] {
  const [mode, setMode] = useState<CheckoffMode>("single");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "multi" || saved === "single") setMode(saved);
  }, []);

  const update = (m: CheckoffMode) => {
    setMode(m);
    localStorage.setItem(KEY, m);
  };

  return [mode, update];
}

/** Same as useCheckoffMode but also reports whether localStorage was read. */
export function useCheckoffModeLoaded(): [CheckoffMode, boolean] {
  const [mode, setMode] = useState<CheckoffMode>("single");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "multi" || saved === "single") setMode(saved);
    setLoaded(true);
  }, []);

  return [mode, loaded];
}
