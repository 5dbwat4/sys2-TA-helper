"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";
import type { Experiment, MatchedStudent } from "./checkoff-store";

export function StudentFinder({
  experiment,
  onSelect,
}: {
  experiment: Experiment;
  onSelect: (s: MatchedStudent) => void;
}) {
  const t = useTranslations("checkoff");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MatchedStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/checkoff?experimentId=${experiment.id}&q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      setResults(data.matchedStudents ?? []);
    } finally {
      setSearching(false);
    }
  };

  const onChange = (value: string) => {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
  };

  const onScan = (code: string) => {
    setScanning(false);
    setQ(code);
    search(code);
  };

  return (
    <div>
      {/* search bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Icon
            icon="lucide:scan-search"
            width={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("searchStudent")}
            className="tabular w-full rounded-2xl border border-line bg-elevated py-3.5 pl-11 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
          {searching && (
            <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2" />
          )}
        </div>
        <Button
          variant="secondary"
          size="lg"
          onPress={() => setScanning((v) => !v)}
          aria-label={t("scan")}
        >
          <Icon icon={scanning ? "lucide:x" : "lucide:barcode"} width={18} />
          <span className="hidden sm:inline">{t("scan")}</span>
        </Button>
      </motion.div>

      {/* scanner */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 overflow-hidden rounded-2xl"
          >
            <CameraBarcodeScanner onDetected={onScan} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* results */}
      <div className="mt-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {results.map((st, i) => {
            const checked = st.submission?.acceptanceScore !== null && st.submission !== null;
            return (
              <motion.button
                key={st.id}
                type="button"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onSelect(st)}
                className="flex w-full items-center gap-4 rounded-2xl border border-line bg-elevated p-4 text-left transition-all hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-amber-500/10 text-sm font-bold text-brand-600 dark:text-brand-300">
                  {st.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{st.name}</span>
                    {st.board?.isShared && (
                      <Chip size="sm" color="warning" variant="soft">
                        {t("sharedBoard")}
                      </Chip>
                    )}
                    {st.hasCheckpoint && (
                      <Chip size="sm" color="accent" variant="soft">
                        Checkpoint
                      </Chip>
                    )}
                  </div>
                  <div className="tabular mt-0.5 text-xs text-fg-muted">
                    {st.studentId}
                    {st.board && ` · ${st.board.dbNo}`}
                    {st.pinyin && ` · ${st.pinyin}`}
                  </div>
                </div>
                {checked ? (
                  <Chip size="sm" color="success" variant="soft">
                    <Icon icon="lucide:check" width={12} />
                    {st.submission!.acceptanceScore}
                  </Chip>
                ) : (
                  <Icon icon="lucide:chevron-right" width={18} className="text-fg-subtle" />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
        {q && !searching && results.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-10 text-center text-sm text-fg-subtle"
          >
            {t("searchStudent")} — “{q}”
          </motion.p>
        )}
      </div>
    </div>
  );
}
