"use client";

import { useState } from "react";

import { ProviderConfigForm } from "@/components/settings/provider-config-form";
import { ProviderStatusGrid } from "@/components/settings/provider-status-grid";

export type ActiveCapability = "text" | "image" | "tts" | "search";

type ProviderSetupStatus = {
  hasTextProvider: boolean;
  hasImageProvider: boolean;
  hasTtsProvider: boolean;
  hasSearchProvider: boolean;
  manualInputAvailable: boolean;
  canStartFormalLearning: boolean;
};

type TemplateItem = {
  id: string;
  name: string;
  capability: "text" | "image" | "tts" | "stt" | "search" | "data";
  defaultBaseUrl: string | null;
  defaultModel: string | null;
};

type ConfigItem = {
  id: string;
  templateId: string;
  displayName: string;
  capability: string;
  baseUrl: string | null;
  model: string | null;
  apiKeyLast4: string | null;
  mapping: Record<string, unknown>;
  enabled: boolean;
};

type ProviderCapabilityPanelProps = {
  status: ProviderSetupStatus;
  templates: TemplateItem[];
  configs: ConfigItem[];
};

const CAPABILITY_HINTS: Record<ActiveCapability, string> = {
  text: "正式副本钥匙：进入战斗、生成漫画分镜、做反馈解释都用文字模型。",
  image: "把英文文字变成副本封面 / 漫画分镜 / 怪兽卡 / 装备卡 / 通关卡。缺这层会降级为文本卡。",
  tts: "英文朗读语音，所有 TTS 调用都走标记为「AI 生成语音」的播放器。",
  search: "找真实英文内容：网页 / 文章 / 故事。缺这层时仍可粘贴 URL / 文本兜底。"
};

export function ProviderCapabilityPanel({
  status,
  templates,
  configs
}: ProviderCapabilityPanelProps) {
  const [active, setActive] = useState<ActiveCapability>("text");
  const filteredTemplates = templates.filter((template) => template.capability === active);
  const filteredConfigs = configs.filter((config) => config.capability === active);

  return (
    <>
      <ProviderStatusGrid status={status} activeCapability={active} onSelect={setActive} />
      <p className="capability-hint">{CAPABILITY_HINTS[active]}</p>
      <ProviderConfigForm key={active} configs={filteredConfigs} templates={filteredTemplates} />
    </>
  );
}
