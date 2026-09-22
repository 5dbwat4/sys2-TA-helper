"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "motion/react";
import { Button } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export default function TokenLoginPage() {
  const t = useTranslations("auth.token");

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-w-sm flex-col items-center text-center"
      >
        <motion.div
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-xl shadow-amber-500/30"
        >
          <Icon icon="lucide:hard-hat" width={36} />
        </motion.div>

        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="tabular mt-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          {t("wip")}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">{t("wipDesc")}</p>

        <Link href="/login" className="mt-8">
          <Button variant="secondary">
            <Icon icon="lucide:arrow-left" width={16} />
            {t("backToLogin")}
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
