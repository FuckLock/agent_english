import type { ReactNode } from "react";
import { Compass } from "lucide-react";

type EmptyQuestStateProps = {
  actions?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
};

export function EmptyQuestState({
  actions,
  description,
  icon = <Compass aria-hidden="true" size={26} strokeWidth={2.5} />,
  title
}: EmptyQuestStateProps) {
  return (
    <div className="empty-quest-state">
      <div className="empty-quest-state__icon">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
      {actions ? <div className="state-action-row">{actions}</div> : null}
    </div>
  );
}
