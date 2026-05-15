import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Database, Plug, Volume2 } from "lucide-react";

import { DataManagementPanel } from "@/components/settings/data-management-panel";
import { ProviderConfigForm } from "@/components/settings/provider-config-form";
import { ProviderStatusGrid } from "@/components/settings/provider-status-grid";
import { ProviderTemplateList } from "@/components/settings/provider-template-list";
import { ProviderUsageList } from "@/components/settings/provider-usage-list";
import { getDataManagementSummary } from "@/server/data/export-service";
import {
  getUiPreferences,
  updateUiPreferences
} from "@/server/preferences/ui-preferences";
import { getProviderSettingsData } from "@/server/repositories/provider-repository";

export const dynamic = "force-dynamic";

async function saveUiPreferences(formData: FormData) {
  "use server";
  updateUiPreferences({
    audioEnabled: formData.get("audioEnabled") === "on",
    reduceMotion: formData.get("reduceMotion") === "on",
    lowImage: formData.get("lowImage") === "on",
    audioConfirmed: true
  });
  revalidatePath("/settings");
  revalidatePath("/");
}

export default function SettingsPage() {
  const data = getProviderSettingsData();
  const dataSummary = getDataManagementSummary();
  const prefs = getUiPreferences();

  return (
    <main className="settings-shell">
      <section className="settings-hero" aria-labelledby="settings-title">
        <div>
          <p className="section-kicker">Settings</p>
          <h1 id="settings-title">能力设置中心</h1>
          <p>三个区域：配置能力 · 调整体验 · 管理数据。日常学习仍从地图开始。</p>
        </div>
        <Link className="settings-link-button" href="/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={2.6} />
          返回地图
        </Link>
      </section>

      <section className="settings-section" aria-labelledby="caps-title">
        <header className="settings-section__head">
          <Plug aria-hidden="true" size={20} strokeWidth={2.6} />
          <div>
            <p className="section-kicker">Section 1 · Capabilities</p>
            <h2 id="caps-title">能力配置</h2>
            <p>文字 / 图片 / 语音 / 搜索 Provider 与模板。</p>
          </div>
        </header>
        <ProviderStatusGrid status={data.status} />
        <ProviderConfigForm configs={data.configs} templates={data.templates} />
        <ProviderTemplateList templates={data.templates} />
      </section>

      <section className="settings-section" aria-labelledby="exp-title">
        <header className="settings-section__head">
          <Volume2 aria-hidden="true" size={20} strokeWidth={2.6} />
          <div>
            <p className="section-kicker">Section 2 · Experience</p>
            <h2 id="exp-title">体验偏好</h2>
            <p>音效 / 动效 / 省图模式。首次进入默认静音，由你确认后再开。</p>
          </div>
        </header>
        {prefs.audioConfirmed ? null : (
          <p className="ui-prefs-hint">
            第一次进入游戏，默认静音。如果你想要音效（点击 / 命中 / 通关 / 装备 / 错误），先在下面打开再保存。
          </p>
        )}
        <form action={saveUiPreferences} className="ui-prefs-form">
          <label>
            <input
              type="checkbox"
              name="audioEnabled"
              defaultChecked={prefs.audioEnabled}
            />
            <span>开启音效（点击 / 命中 / 通关 / 装备掉落 / 错误）</span>
          </label>
          <label>
            <input
              type="checkbox"
              name="reduceMotion"
              defaultChecked={prefs.reduceMotion}
            />
            <span>减少动效（战斗、结算、装备掉落动画降到最小）</span>
          </label>
          <label>
            <input
              type="checkbox"
              name="lowImage"
              defaultChecked={prefs.lowImage}
            />
            <span>省图模式（图片任务默认走 draft 档位）</span>
          </label>
          <button type="submit" className="settings-link-button settings-link-button--dark">
            保存偏好
          </button>
        </form>
      </section>

      <section className="settings-section" aria-labelledby="data-title">
        <header className="settings-section__head">
          <Database aria-hidden="true" size={20} strokeWidth={2.6} />
          <div>
            <p className="section-kicker">Section 3 · Data</p>
            <h2 id="data-title">数据管理</h2>
            <p>导出学习记录 / 清空数据 / 查看 Provider 调用历史。</p>
          </div>
        </header>
        <DataManagementPanel summary={dataSummary} />
        <details className="usage-details">
          <summary>Provider 调用历史（默认折叠）</summary>
          <ProviderUsageList recentUsage={data.recentUsage} />
        </details>
      </section>
    </main>
  );
}
