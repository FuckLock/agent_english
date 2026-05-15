import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import {
  getBodyClassFromPreferences,
  getUiPreferences
} from "@/server/preferences/ui-preferences";

import "./globals.css";

export const metadata: Metadata = {
  title: "English Monster Quest",
  description: "快乐游戏化英语学习工具"
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const prefs = getUiPreferences();
  const bodyClass = getBodyClassFromPreferences(prefs);

  return (
    <html lang="zh-CN">
      <body className={bodyClass}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
