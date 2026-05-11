import type { CSSProperties } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Zap
} from "lucide-react";

import { GameButton } from "@/components/ui/game-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { dungeons as fallbackDungeons } from "@/lib/design-tokens";
import { getHomeOverview } from "@/server/repositories/game-repository";
import { getProviderSetupStatus } from "@/server/repositories/provider-repository";

export const dynamic = "force-dynamic";

type PinStyle = CSSProperties & {
  "--pin-color": string;
};

const fallbackMapPins = [
  {
    title: "Cafe Mystery",
    meta: "A2 · 点餐听力",
    top: "21%",
    left: "17%",
    tone: "#FF7A59",
    active: true
  },
  {
    title: "Bakery Chase",
    meta: "A1 · 漫画跟读",
    top: "58%",
    left: "35%",
    tone: "#19A974",
    active: false
  },
  {
    title: "Moon Station",
    meta: "B1 · 科幻阅读",
    top: "34%",
    left: "64%",
    tone: "#4F7CFF",
    active: false
  },
  {
    title: "Word Forge",
    meta: "A2 · 单词铸造",
    top: "70%",
    left: "72%",
    tone: "#F4B740",
    active: false
  }
] as const;

export default function Home() {
  const home = getHomeOverview();
  const providerStatus = getProviderSetupStatus();
  const mapPins = home.dungeons.length > 0 ? home.dungeons : fallbackMapPins;
  const dailyDungeons = home.dungeons.length > 0 ? home.dungeons.slice(0, 3) : fallbackDungeons;

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
        <section className="panel map-panel" id="map" aria-labelledby="map-title">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Dungeon Map</p>
              <h2 id="map-title">选择今天的入口</h2>
            </div>
            <GameButton icon={<Search size={16} strokeWidth={2.6} />} size="sm" variant="secondary">
              找副本
            </GameButton>
          </div>

          <div className="map-board" aria-label="今日副本地图">
            <div className="map-region map-region--market">
              <ImageIcon aria-hidden="true" size={18} strokeWidth={2.5} />
              <span>Comic Town</span>
            </div>
            <div className="map-region map-region--dock">
              <MessageCircle aria-hidden="true" size={18} strokeWidth={2.5} />
              <span>Talk Harbor</span>
            </div>
            <span className="route-line route-line--one" />
            <span className="route-line route-line--two" />
            <span className="route-line route-line--three" />

            {mapPins.map((pin, index) => (
              <article
                className={index === 0 ? "dungeon-pin is-active" : "dungeon-pin"}
                key={pin.title}
                style={
                  {
                    "--pin-color": pin.tone,
                    left: "mapLeft" in pin ? pin.mapLeft : pin.left,
                    top: "mapTop" in pin ? pin.mapTop : pin.top
                  } as PinStyle
                }
              >
                <span className="dungeon-pin__dot">
                  {index === 0 ? (
                    <Swords aria-hidden="true" size={16} strokeWidth={2.8} />
                  ) : (
                    <MapPin aria-hidden="true" size={16} strokeWidth={2.8} />
                  )}
                </span>
                <span>
                  <strong>{pin.title}</strong>
                  <small>{"tag" in pin ? `${pin.level} · ${pin.tag}` : pin.meta}</small>
                </span>
              </article>
            ))}
          </div>

          <div className="daily-grid" id="discover">
            {dailyDungeons.map((dungeon) => (
              <article
                className="quest-card"
                key={dungeon.title}
                style={{ "--card-tone": dungeon.tone } as CSSProperties & { "--card-tone": string }}
              >
                <span className="quest-card__stripe" />
                <div className="quest-card__top">
                  <span>{dungeon.level}</span>
                  <strong>+{dungeon.xp} XP</strong>
                </div>
                <h3>{dungeon.title}</h3>
                <p>{dungeon.tag}</p>
                <ProgressBar label="通关进度" value={dungeon.progress} />
              </article>
            ))}
          </div>
        </section>

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
