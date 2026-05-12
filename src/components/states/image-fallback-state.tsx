import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ImageOff, LoaderCircle } from "lucide-react";

type ImageFallbackStateProps = {
  action?: ReactNode;
  detail?: string | null;
  label: string;
  tone: "ready" | "pending" | "failed" | "skipped";
};

const iconMap = {
  failed: AlertTriangle,
  pending: LoaderCircle,
  ready: CheckCircle2,
  skipped: ImageOff
};

export function ImageFallbackState({ action, detail, label, tone }: ImageFallbackStateProps) {
  const Icon = iconMap[tone];

  return (
    <div className={`image-fallback-state image-fallback-state--${tone}`}>
      <Icon aria-hidden="true" className={tone === "pending" ? "is-spinning" : undefined} size={16} />
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
      {action}
    </div>
  );
}
