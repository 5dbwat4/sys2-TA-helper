"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@heroui/react";
import { Icon } from "./Icon";

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  const next = locale === "zh" ? "en" : "zh";

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("language")}
      onPress={() => router.replace(pathname, { locale: next })}
      className="font-semibold tracking-wide"
    >
      <Icon icon="lucide:languages" width={16} />
      {next === "en" ? "EN" : "中"}
    </Button>
  );
}
