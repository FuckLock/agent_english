import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

import { DataManagementPanel } from "@/components/settings/data-management-panel";
import { ProviderConfigForm } from "@/components/settings/provider-config-form";
import { ProviderStatusGrid } from "@/components/settings/provider-status-grid";
import { ProviderTemplateList } from "@/components/settings/provider-template-list";
import { ProviderUsageList } from "@/components/settings/provider-usage-list";
import { getDataManagementSummary } from "@/server/data/export-service";
import { getProviderSettingsData } from "@/server/repositories/provider-repository";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const data = getProviderSettingsData();
  const dataSummary = getDataManagementSummary();

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
          <DataManagementPanel summary={dataSummary} />
        </div>
      </div>

      <ProviderTemplateList templates={data.templates} />
    </main>
  );
}
