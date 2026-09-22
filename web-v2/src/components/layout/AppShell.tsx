"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link, useRouter } from "@/i18n/navigation";
import { motion } from "motion/react";
import { Button } from "@heroui/react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

const STAFF_NAV = [
  { href: "/console", key: "console", icon: "lucide:layout-dashboard" },
  { href: "/console/checkoff", key: "checkoff", icon: "lucide:clipboard-check" },
  { href: "/console/quizzes", key: "quizzes", icon: "lucide:file-question" },
  { href: "/console/boards", key: "boards", icon: "lucide:circuit-board" },
  { href: "/console/experiments", key: "experiments", icon: "lucide:flask-conical" },
  { href: "/console/assignments", key: "assignments", icon: "lucide:pen-line" },
  { href: "/console/settings", key: "settings", icon: "lucide:settings-2" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();

  const isStudent = session?.role === "STUDENT";
  const isTeacher = session?.role === "TEACHER";
  const navItems = isStudent
    ? ([{ href: "/me", key: "me", icon: "lucide:user-round" }] as const)
    : STAFF_NAV.filter((item) => (isTeacher ? item.key !== "checkoff" : true));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(t("auth.logoutSuccess"));
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-elevated/60 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/25">
            <Icon icon="lucide:cpu" width={20} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">{t("common.appName")}</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-fg-subtle">
              ZJU · CS-II
            </div>
          </div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const active =
              item.href === "/console"
                ? pathname === "/console"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-brand-500/10 ring-1 ring-brand-500/25 dark:bg-brand-400/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon
                  icon={item.icon}
                  className={cn(
                    "relative transition-colors",
                    active ? "text-brand-600 dark:text-brand-300" : "group-hover:text-fg",
                  )}
                />
                <span className="relative">{t(`nav.${item.key}`)}</span>
                {active && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute right-3 h-1.5 w-1.5 rounded-full bg-amber-500"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-600 dark:text-amber-400">
              {session?.name?.slice(0, 1) ?? "·"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{session?.name ?? "—"}</div>
              <div className="truncate text-xs text-fg-subtle tabular">{session?.studentId}</div>
            </div>
            <Button isIconOnly variant="ghost" size="sm" aria-label={t("common.logout")} onPress={logout}>
              <Icon icon="lucide:log-out" width={16} className="text-fg-muted" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-60">
        {/* Topbar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line px-4 md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Icon icon="lucide:cpu" width={16} />
            </div>
            <span className="text-sm font-bold">{t("common.appName")}</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="md:hidden"
              aria-label={t("common.logout")}
              onPress={logout}
            >
              <Icon icon="lucide:log-out" width={16} />
            </Button>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden">
          {navItems.map((item) => {
            const active =
              item.href === "/console" ? pathname === "/console" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-brand-600 dark:text-brand-300" : "text-fg-subtle",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    className="absolute -top-px h-0.5 w-10 rounded-full bg-gradient-to-r from-brand-500 to-amber-500"
                  />
                )}
                <Icon icon={item.icon} width={20} />
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
