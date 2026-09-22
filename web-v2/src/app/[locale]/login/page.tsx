import { setRequestLocale } from "next-intl/server";
import { LoginBrandPanel } from "@/components/auth/LoginBrandPanel";
import { LoginPanel } from "@/components/auth/LoginPanel";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen">
      <LoginBrandPanel />
      <LoginPanel />
    </div>
  );
}
