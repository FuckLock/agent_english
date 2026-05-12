import { AlertTriangle, CheckCircle2, Info, LoaderCircle } from "lucide-react";

type ProviderTestAlertProps = {
  text: string;
  tone: "success" | "error" | "info" | "loading";
};

const iconMap = {
  error: AlertTriangle,
  info: Info,
  loading: LoaderCircle,
  success: CheckCircle2
};

export function ProviderTestAlert({ text, tone }: ProviderTestAlertProps) {
  const Icon = iconMap[tone];

  return (
    <div className={`provider-test-alert provider-test-alert--${tone}`} role="status">
      <Icon aria-hidden="true" className={tone === "loading" ? "is-spinning" : undefined} size={17} />
      <span>{text}</span>
    </div>
  );
}
