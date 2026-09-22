"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { ZjuSection } from "@/components/settings/ZjuSection";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
      </motion.div>

      <div className="space-y-4">
        <ProfileSection />
        <SecuritySection />
        <ZjuSection />
      </div>
    </div>
  );
}
