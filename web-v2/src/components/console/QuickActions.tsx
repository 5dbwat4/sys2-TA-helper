"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";

const ACTIONS = [
  {
    href: "/console/checkoff",
    key: "goCheckoff",
    icon: "lucide:clipboard-check",
    gradient: "from-brand-500 to-brand-700",
    shadow: "shadow-brand-600/25",
  },
  {
    href: "/console/boards",
    key: "goBoards",
    icon: "lucide:circuit-board",
    gradient: "from-amber-500 to-amber-700",
    shadow: "shadow-amber-600/25",
  },
  {
    href: "/console/assignments",
    key: "goGrading",
    icon: "lucide:pen-line",
    gradient: "from-emerald-500 to-emerald-700",
    shadow: "shadow-emerald-600/25",
  },
] as const;

export function QuickActions() {
  const t = useTranslations("console");

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ACTIONS.map((a, i) => (
        <motion.div
          key={a.href}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href={a.href}
            className={`group flex items-center gap-3 rounded-2xl bg-gradient-to-br ${a.gradient} p-4 text-white shadow-lg ${a.shadow} transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]`}
          >
            <div className="rounded-xl bg-white/15 p-2 backdrop-blur transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Icon icon={a.icon} width={20} />
            </div>
            <span className="text-sm font-semibold">{t(a.key)}</span>
            <Icon
              icon="lucide:arrow-up-right"
              width={16}
              className="ml-auto opacity-60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
            />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
