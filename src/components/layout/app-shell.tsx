import {
  BookOpenText,
  Compass,
  Gem,
  Search,
  Settings,
  Trophy
} from "lucide-react";
import type { ReactNode } from "react";

import { appCopy, navItems } from "@/lib/design-tokens";
import { getUserProgressSummary } from "@/server/repositories/game-repository";

const navIcons = {
  map: Compass,
  discover: BookOpenText,
  vault: Trophy,
  settings: Settings
};

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const progress = getUserProgressSummary();

  return (
    <div className="app-shell">
      <header className="app-header">
        <a aria-label={`${appCopy.productName} 首页`} className="brand" href="/">
          <span className="brand__sigil" aria-hidden="true">
            <Gem size={20} strokeWidth={2.7} />
          </span>
          <span className="brand__text">{appCopy.productName}</span>
        </a>

        <label className="top-search">
          <Search aria-hidden="true" size={18} strokeWidth={2.4} />
          <input aria-label="搜索副本或单词" placeholder="搜副本、漫画、单词" />
        </label>

        <nav aria-label="主导航" className="top-nav">
          {navItems.map((item) => {
            const Icon = navIcons[item.id];

            return (
              <a className="top-nav__item" href={item.href} key={item.id}>
                <Icon aria-hidden="true" size={16} strokeWidth={2.5} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="xp-pill" aria-label={`${progress.levelLabel} ${progress.xpLabel}`}>
          <Trophy aria-hidden="true" size={17} strokeWidth={2.5} />
          <span>{progress.levelLabel}</span>
          <strong>{progress.xpLabel}</strong>
        </div>
      </header>

      {children}

      <nav aria-label="移动端主导航" className="mobile-nav">
        {navItems.map((item) => {
          const Icon = navIcons[item.id];

          return (
            <a className="mobile-nav__item" href={item.href} key={item.id}>
              <Icon aria-hidden="true" size={19} strokeWidth={2.5} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
