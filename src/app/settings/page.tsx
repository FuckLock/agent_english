import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft, SlidersHorizontal, Volume2 } from "lucide-react";

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
          <p>配置文字、图片、语音和搜索能力；日常学习仍从地图开始。</p>
        </div>
        <Link className="settings-link-button" href="/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={2.6} />
          返回地图
        </Link>
      </section>

      <ProviderStatusGrid status={data.status} />

      <div className="settings-grid">
        <ProviderConfigForm configs={data.configs} templates={data.templates} />
        <div className="settings-side-stack">
          <section className="settings-panel settings-panel--compact">
            <div className="settings-panel__heading">
              <p className="section-kicker">Route Guard</p>
              <h2>学习入口</h2>
            </div>
            <div className="route-guard">
              <SlidersHorizontal aria-hidden="true" size={22} strokeWidth={2.6} />
              <div>
                <strong>
                  {data.status.canStartFormalLearning ? "正式副本已开放" : "正式副本暂锁定"}
                </strong>
                <span>
                  {data.status.canStartFormalLearning
                    ? "图片和搜索缺失时会自动走降级路径。"
                    : "至少保存一个文字 Provider 后再开始正式学习。"}
                </span>
              </div>
            </div>
          </section>
          <ProviderUsageList recentUsage={data.recentUsage} />
          <section className="settings-panel ui-preferences" aria-labelledby="ui-prefs-title">
            <div className="settings-panel__heading">
              <p className="section-kicker">Experience</p>
              <h2 id="ui-prefs-title">
                <Volume2 aria-hidden="true" size={18} strokeWidth={2.6} /> 游戏体验偏好
              </h2>
            </div>
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
          <DataManagementPanel summary={dataSummary} />
        </div>
      </div>

      <ProviderTemplateList templates={data.templates} />
    </main>
  );
}
