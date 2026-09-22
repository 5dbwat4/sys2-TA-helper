import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { manrope, notoSansSC, jetbrainsMono } from "@/lib/fonts";
import { Providers } from "./providers";
import "../globals.css";

export const metadata: Metadata = {
  title: "CS-II TA Console",
  description: "Computer Systems II TA Management System",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${manrope.variable} ${notoSansSC.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider>
          <Providers>
            <div className="aurora" aria-hidden />
            <div className="grid-overlay" aria-hidden />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
