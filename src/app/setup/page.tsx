import Link from "next/link";
import { ArrowRight, Map, Sword } from "lucide-react";

import { ProviderConfigForm } from "@/components/settings/provider-config-form";
import { ProviderStatusGrid } from "@/components/settings/provider-status-grid";
import { ProviderTemplateList } from "@/components/settings/provider-template-list";
import { getProviderSettingsData } from "@/server/repositories/provider-repository";
import { isPrologueComplete, PROLOGUE_LESSON_ID } from "@/server/lessons/prologue-service";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const data = getProviderSettingsData();
  const prologueComplete = isPrologueComplete();

  return (
    <main className="settings-shell">
      <section className="setup-hero" aria-labelledby="setup-title">
        <div>
          <p className="section-kicker">Setup</p>
          <h1 id="setup-title">先把冒险装备配好</h1>
          <p>文字模型是正式副本钥匙；图片和搜索可以稍后补齐。</p>
        </div>
        <Link className="settings-link-button settings-link-button--dark" href="/">
          <Map aria-hidden="true" size={17} strokeWidth={2.6} />
          看地图
        </Link>
      </section>

      <ProviderStatusGrid status={data.status} />

      <div className="settings-grid">
        <ProviderConfigForm configs={data.configs} templates={data.templates} />
        <section className="settings-panel setup-checklist" aria-labelledby="setup-checklist-title">
          <div className="settings-panel__heading">
            <p className="section-kicker">Ready Check</p>
            <h2 id="setup-checklist-title">出发条件</h2>
          </div>
          <ol>
            <li className={data.status.hasTextProvider ? "is-done" : ""}>保存一个文字 Provider</li>
            <li className={data.status.hasImageProvider ? "is-done" : ""}>图片缺失时使用文本卡</li>
            <li className={data.status.hasSearchProvider ? "is-done" : ""}>搜索缺失时手动输入</li>
          </ol>
          <Link className="settings-link-button" href="/settings">
            打开设置中心
            <ArrowRight aria-hidden="true" size={17} strokeWidth={2.6} />
          </Link>
          {data.status.hasTextProvider ? (
            <Link
              className="settings-link-button settings-link-button--dark"
              href={`/lessons/${PROLOGUE_LESSON_ID}`}
            >
              <Sword aria-hidden="true" size={17} strokeWidth={2.6} />
              {prologueComplete ? "重打序章副本" : "进入序章副本"}
            </Link>
          ) : null}
        </section>
      </div>

      <ProviderTemplateList templates={data.templates} />
    </main>
  );
}
