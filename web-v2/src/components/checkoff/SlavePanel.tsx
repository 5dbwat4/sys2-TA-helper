"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Button } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";

export function SlavePanel({
  code,
  token,
  slaveConnected,
}: {
  code: string;
  token: string;
  slaveConnected: boolean;
}) {
  const t = useTranslations("checkoff.multi");
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/checkin/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(url);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-r from-brand-500/8 to-amber-500/5"
    >
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
            <Icon icon="lucide:monitor-smartphone" width={22} />
            <motion.span
              className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${slaveConnected ? "bg-emerald-500" : "bg-line"}`}
              animate={slaveConnected ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-fg-muted">{t("slaveCode")}</div>
            <div className="tabular text-2xl font-bold tracking-[0.2em]">{code}</div>
          </div>
        </div>

        <div className="h-10 w-px bg-line" />

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-fg-muted">{t("slaveUrl")}</div>
          <div className="tabular truncate text-sm font-medium">{url.replace(/^https?:\/\//, "")}</div>
        </div>

        <Button size="sm" variant="secondary" onPress={copy}>
          <Icon icon={copied ? "lucide:check" : "lucide:copy"} width={14} />
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>
    </motion.div>
  );
}
