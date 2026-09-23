"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { SettingsCard } from "./SettingsCard";
import { useCheckoffMode } from "@/lib/use-checkoff-mode";

export function PrefsSection() {
  const t = useTranslations("settings");
  const [mode, setMode] = useCheckoffMode();
  const multi = mode === "multi";

  return (
    <SettingsCard
      icon="lucide:sliders-horizontal"
      title={t("prefs")}
      description={t("checkoffModeDesc")}
      index={3}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <Icon icon={multi ? "lucide:monitor-smartphone" : "lucide:laptop"} width={18} />
          </div>
          <div>
            <div className="text-sm font-semibold">{t("checkoffMode")}</div>
            <div className="text-xs text-fg-muted">
              {multi ? t("modeMulti") : t("modeSingle")}
            </div>
          </div>
        </div>
        <Switch
          isSelected={multi}
          onChange={(selected) => setMode(selected ? "multi" : "single")}
          aria-label={t("checkoffMode")}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
    </SettingsCard>
  );
}