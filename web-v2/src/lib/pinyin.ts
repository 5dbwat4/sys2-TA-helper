import { pinyin } from "pinyin-pro";

export interface PinyinInfo {
  /** Full tone-less pinyin, lowercase, no separators, e.g. "wangruochen" */
  full: string;
  /** Initials of each syllable, lowercase, e.g. "wrc" */
  initials: string;
}

/**
 * Compute searchable pinyin for a Chinese name.
 * Used at write time (seed / import) so lookups stay cheap and dependency-free.
 */
export function computePinyin(name: string): PinyinInfo {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { full: "", initials: "" };

  const full = pinyin(trimmed, { toneType: "none", type: "array", nonZh: "consecutive" })
    .join("")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  const initials = pinyin(trimmed, {
    pattern: "first",
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
  })
    .join("")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  return { full, initials };
}