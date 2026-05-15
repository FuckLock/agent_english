"use client";

import {
  AudioLines,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Search,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";

type ProviderSetupStatus = {
  hasTextProvider: boolean;
  hasImageProvider: boolean;
  hasTtsProvider: boolean;
  hasSearchProvider: boolean;
  manualInputAvailable: boolean;
  canStartFormalLearning: boolean;
};

type Capability = "text" | "image" | "tts" | "search";

type ProviderStatusGridProps = {
  status: ProviderSetupStatus;
  activeCapability?: Capability;
  onSelect?: (capability: Capability) => void;
};

type StatusItem = {
  label: string;
  detail: string;
  ready: boolean;
  tone: "ready" | "warn" | "blocked";
  Icon: LucideIcon;
  capability: Capability | null;
};

export function ProviderStatusGrid({
  status,
  activeCapability,
  onSelect
}: ProviderStatusGridProps) {
  const items: StatusItem[] = [
    {
      label: "文字模型",
      detail: status.hasTextProvider ? "正式副本可进入" : "正式学习暂锁定",
      ready: status.hasTextProvider,
      tone: status.hasTextProvider ? "ready" : "blocked",
      Icon: FileText,
      capability: "text"
    },
    {
      label: "图片生成",
      detail: status.hasImageProvider ? "漫画体验可用" : "先用文本卡",
      ready: status.hasImageProvider,
      tone: status.hasImageProvider ? "ready" : "warn",
      Icon: ImageIcon,
      capability: "image"
    },
    {
      label: "语音 TTS",
      detail: status.hasTtsProvider ? "英文朗读可用" : "未配置则隐藏播放",
      ready: status.hasTtsProvider,
      tone: status.hasTtsProvider ? "ready" : "warn",
      Icon: AudioLines,
      capability: "tts"
    },
    {
      label: "搜索服务",
      detail: status.hasSearchProvider ? "可搜索副本" : "可手动输入",
      ready: status.hasSearchProvider,
      tone: status.hasSearchProvider ? "ready" : "warn",
      Icon: Search,
      capability: "search"
    },
    {
      label: "手动输入",
      detail: "URL / 文本可用",
      ready: status.manualInputAvailable,
      tone: "ready",
      Icon: Keyboard,
      capability: null
    }
  ];

  const isInteractive = Boolean(onSelect);

  return (
    <div className="status-grid" role="group" aria-label="Provider 能力配置">
      {items.map((item) => {
        const isActive = item.capability !== null && item.capability === activeCapability;
        const canClick = isInteractive && item.capability !== null;
        const className = [
          "status-card",
          `status-card--${item.tone}`,
          canClick ? "status-card--clickable" : "",
          isActive ? "status-card--active" : ""
        ]
          .filter(Boolean)
          .join(" ");

        if (canClick) {
          return (
            <button
              aria-pressed={isActive}
              className={className}
              key={item.label}
              onClick={() => onSelect?.(item.capability as Capability)}
              type="button"
            >
              <StatusBody item={item} />
            </button>
          );
        }

        return (
          <div className={className} key={item.label}>
            <StatusBody item={item} />
          </div>
        );
      })}
    </div>
  );
}

function StatusBody({ item }: { item: StatusItem }) {
  return (
    <>
      <div className="status-card__icon">
        <item.Icon aria-hidden="true" size={20} strokeWidth={2.6} />
      </div>
      <div className="status-card__body">
        <strong>{item.label}</strong>
        <span>{item.detail}</span>
      </div>
      {item.ready ? (
        <ShieldCheck aria-hidden="true" size={17} strokeWidth={2.6} />
      ) : (
        <ShieldAlert aria-hidden="true" size={17} strokeWidth={2.6} />
      )}
    </>
  );
}
