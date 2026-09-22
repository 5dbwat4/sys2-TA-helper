"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Spinner } from "@heroui/react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function TeacherLoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "teacher", name: name.trim(), password }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("login") + " ✓");
      router.replace("/console");
      router.refresh();
    } catch {
      toast.error(t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={submit}
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("name")}</label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("password")}</label>
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" fullWidth isPending={loading} className="mt-2">
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:arrow-right" width={16} />}
            {isPending ? t("loggingIn") : t("login")}
          </>
        )}
      </Button>
    </motion.form>
  );
}
