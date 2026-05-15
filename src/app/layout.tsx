import type { Metadata } from "next";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";

import { AppShell } from "@/components/layout/app-shell";
import {
  getBodyClassFromPreferences,
  getUiPreferences,
  updateUiPreferences
} from "@/server/preferences/ui-preferences";

import "./globals.css";

export const metadata: Metadata = {
  title: "English Monster Quest",
  description: "快乐游戏化英语学习工具"
};

export const dynamic = "force-dynamic";

async function confirmFirstAudio(formData: FormData) {
  "use server";
  updateUiPreferences({
    audioEnabled: formData.get("enable") === "yes",
    audioConfirmed: true
  });
  revalidatePath("/");
}

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
        {!prefs.audioConfirmed ? (
          <aside
            className="first-audio-prompt"
            role="dialog"
            aria-labelledby="first-audio-title"
          >
            <div>
              <strong id="first-audio-title">是否开启音效？</strong>
              <p>
                点击、命中、通关、装备掉落、错误提示会触发轻反馈音。
                可在设置中心随时调整。
              </p>
            </div>
            <form action={confirmFirstAudio} className="first-audio-prompt__actions">
              <button
                className="settings-link-button settings-link-button--dark"
                name="enable"
                type="submit"
                value="yes"
              >
                开启音效
              </button>
              <button
                className="settings-link-button"
                name="enable"
                type="submit"
                value="no"
              >
                保持静音
              </button>
            </form>
          </aside>
        ) : null}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
