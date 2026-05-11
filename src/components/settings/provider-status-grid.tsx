import {
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
  hasSearchProvider: boolean;
  manualInputAvailable: boolean;
  canStartFormalLearning: boolean;
};

type ProviderStatusGridProps = {
  status: ProviderSetupStatus;
};

type StatusItem = {
  label: string;
  detail: string;
  ready: boolean;
  tone: "ready" | "warn" | "blocked";
  Icon: LucideIcon;
};

export function ProviderStatusGrid({ status }: ProviderStatusGridProps) {
  const items: StatusItem[] = [
    {
      label: "文字模型",
      detail: status.hasTextProvider ? "正式副本可进入" : "正式学习暂锁定",
      ready: status.hasTextProvider,
      tone: status.hasTextProvider ? "ready" : "blocked",
      Icon: FileText
    },
    {
      label: "图片生成",
      detail: status.hasImageProvider ? "漫画体验可用" : "先用文本卡",
      ready: status.hasImageProvider,
      tone: status.hasImageProvider ? "ready" : "warn",
      Icon: ImageIcon
    },
    {
      label: "搜索服务",
      detail: status.hasSearchProvider ? "可搜索副本" : "可手动输入",
      ready: status.hasSearchProvider,
      tone: status.hasSearchProvider ? "ready" : "warn",
      Icon: Search
    },
    {
      label: "手动输入",
      detail: status.manualInputAvailable ? "URL / 文本可用" : "未启用",
      ready: status.manualInputAvailable,
      tone: status.manualInputAvailable ? "ready" : "blocked",
      Icon: Keyboard
    }
  ];

  return (
    <section className="status-grid" aria-label="Provider 能力状态">
      {items.map(({ detail, Icon, label, ready, tone }) => {
        const BadgeIcon = ready ? ShieldCheck : ShieldAlert;

        return (
          <article className={`status-card status-card--${tone}`} key={label}>
            <div className="status-card__icon">
              <Icon aria-hidden="true" size={20} strokeWidth={2.5} />
            </div>
            <div>
              <strong>{label}</strong>
              <span>{detail}</span>
            </div>
            <BadgeIcon aria-hidden="true" size={18} strokeWidth={2.5} />
          </article>
        );
      })}
    </section>
  );
}
