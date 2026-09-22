import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import * as jwt from "jsonwebtoken";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZJU TA System",
  description: "Modern TA Management System with Glassmorphism",
};

import { TA_MAPPING } from "@/lib/constants";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let role = null;
  let userName = null;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "ta_super_secret_jwt_key_2026");
      role = decoded.role;
      userName = TA_MAPPING[decoded.studentId] || decoded.name || decoded.studentId;
    } catch (e) {
      // Invalid token
    }
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <Navbar initialRole={role} initialUserName={userName} />
          <main className="flex-1 p-4 md:p-8">
            {children}
          </main>
          <footer className="glass m-4 p-4 text-center text-sm opacity-70">
            &copy; 2026 ZJU Computer Systems II
          </footer>
        </div>
      </body>
    </html>
  );
}
