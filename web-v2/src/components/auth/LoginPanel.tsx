"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { TALoginForm } from "@/components/auth/TALoginForm";
import { TeacherLoginForm } from "@/components/auth/TeacherLoginForm";
import { cn } from "@/lib/utils";

type Role = "student" | "ta" | "teacher";

const ROLES: { key: Role; icon: string; labelKey: string }[] = [
  { key: "student", icon: "lucide:graduation-cap", labelKey: "roleStudent" },
  { key: "ta", icon: "lucide:shield-check", labelKey: "roleTA" },
  { key: "teacher", icon: "lucide:book-open-check", labelKey: "roleTeacher" },
];

export function LoginPanel() {
  const t = useTranslations("auth");
  const [role, setRole] = useState<Role>("ta");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/25">
            <Icon icon="lucide:cpu" width={20} />
          </div>
          <div>
            <div className="font-bold tracking-tight">{t("welcome")}</div>
            <div className="text-xs text-fg-subtle">{t("welcomeSubtitle")}</div>
          </div>
        </div>

        <div className="hidden lg:block">
          <h2 className="text-2xl font-bold tracking-tight">{t("welcome")}</h2>
          <p className="mt-1 text-sm text-fg-muted">{t("welcomeSubtitle")}</p>
        </div>

        {/* role selector */}
        <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-sunken p-1.5">
          {ROLES.map((r) => {
            const active = role === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-semibold transition-colors",
                  active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="role-pill"
                    className="absolute inset-0 rounded-xl bg-elevated shadow-sm ring-1 ring-line"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  icon={r.icon}
                  width={18}
                  className={cn("relative", active && "text-brand-600 dark:text-brand-300")}
                />
                <span className="relative">{t(r.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* form area */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div key={role}>
              {role === "student" && <StudentLoginForm />}
              {role === "ta" && <TALoginForm />}
              {role === "teacher" && <TeacherLoginForm />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
