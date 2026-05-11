import Link from "next/link";
import {
  CheckCircle2,
  MessageCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";

import { DungeonMap } from "@/components/home/dungeon-map";
import { GameButton } from "@/components/ui/game-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getHomeOverview } from "@/server/repositories/game-repository";
import { getProviderSetupStatus } from "@/server/repositories/provider-repository";

export const dynamic = "force-dynamic";

export default function Home() {
  const home = getHomeOverview();
  const providerStatus = getProviderSetupStatus();

  return (
    <main className="page-shell">
      <section className="today-strip" aria-labelledby="today-title">
        <div>
          <p className="section-kicker">今日地图</p>
          <h1 id="today-title">开心打完 3 个英语副本</h1>
        </div>
        <div className="streak-card" aria-label={home.progress.streakLabel}>
          <Sparkles aria-hidden="true" size={18} strokeWidth={2.6} />
          <span>{home.progress.streakLabel}</span>
        </div>
      </section>

      <div className="home-grid">
        <DungeonMap dungeons={home.dungeons} />

        <aside className="challenge-panel" id="vault" aria-labelledby="challenge-title">
          <div className="challenge-panel__top">
            <p className="section-kicker section-kicker--dark">继续挑战</p>
            <span>Round 1 / 3</span>
          </div>

          <div className="monster-card">
            <div className="monster-avatar" aria-hidden="true">
              <Zap size={34} strokeWidth={2.7} />
            </div>
            <div>
              <h2 id="challenge-title">Cafe Mystery</h2>
              <p>Could I get an iced latte, please?</p>
            </div>
          </div>

          <div className="battle-steps" aria-label="挑战状态">
            <div>
              <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.6} />
              <span>目标句</span>
              <strong>已解锁</strong>
            </div>
            <div>
              <MessageCircle aria-hidden="true" size={18} strokeWidth={2.6} />
              <span>中文救援</span>
              <strong>1 次</strong>
            </div>
            <div>
              <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2.6} />
              <span>连击</span>
              <strong>4 Combo</strong>
            </div>
          </div>

          <ProgressBar label="Boss 血量" value={42} />

          {providerStatus.canStartFormalLearning ? (
            <GameButton icon={<Play size={18} fill="currentColor" strokeWidth={2.4} />} variant="dark">
              继续打
            </GameButton>
          ) : (
            <Link className="game-button game-button--dark game-button--md" href="/setup">
              <span className="game-button__icon">
                <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={2.4} />
              </span>
              <span>配置文字模型</span>
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}
