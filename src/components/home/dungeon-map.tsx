import Link from "next/link";
import type { CSSProperties } from "react";
import { Image as ImageIcon, MapPin, MessageCircle, Search, Swords } from "lucide-react";

import { discoveryCategories } from "@/lib/discovery-options";
import { dungeons as fallbackDungeons } from "@/lib/design-tokens";
import type { HomeDungeon } from "@/server/repositories/game-repository";
import { ProgressBar } from "@/components/ui/progress-bar";

type DungeonMapProps = {
  dungeons: HomeDungeon[];
};

type PinStyle = CSSProperties & {
  "--pin-color": string;
};

const fallbackMapPins = [
  {
    title: "Cafe Mystery",
    meta: "A2 · 点餐听力",
    top: "21%",
    left: "17%",
    tone: "#FF7A59"
  },
  {
    title: "Bakery Chase",
    meta: "A1 · 漫画跟读",
    top: "58%",
    left: "35%",
    tone: "#19A974"
  },
  {
    title: "Moon Station",
    meta: "B1 · 科幻阅读",
    top: "34%",
    left: "64%",
    tone: "#4F7CFF"
  },
  {
    title: "Word Forge",
    meta: "A2 · 单词铸造",
    top: "70%",
    left: "72%",
    tone: "#F4B740"
  }
] as const;

export function DungeonMap({ dungeons }: DungeonMapProps) {
  const mapPins = dungeons.length > 0 ? dungeons : fallbackMapPins;
  const dailyDungeons = dungeons.length > 0 ? dungeons.slice(0, 3) : fallbackDungeons;

  return (
    <section className="panel map-panel" id="map" aria-labelledby="map-title">
      <div className="home-discovery-bar" id="discover">
        <form action="/discover" className="home-discovery-search">
          <Search aria-hidden="true" size={17} />
          <input name="q" placeholder="搜奇闻、电影、科技、旅行故事" />
          <button type="submit">找副本</button>
        </form>
        <div className="home-tabs" aria-label="默认内容分类">
          {discoveryCategories.map((category) => (
            <Link href={`/discover?category=${category.id}&q=${category.query}`} key={category.id}>
              {category.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="panel-heading">
        <div>
          <p className="section-kicker">Dungeon Map</p>
          <h2 id="map-title">选择今天的入口</h2>
        </div>
        <Link className="game-button game-button--secondary game-button--sm" href="/discover">
          <span className="game-button__icon">
            <Search aria-hidden="true" size={16} strokeWidth={2.6} />
          </span>
          <span>找副本</span>
        </Link>
      </div>

      <div className="map-board" aria-label="今日副本地图">
        <Link className="map-region map-region--market" href="/discover?category=weird">
          <ImageIcon aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>Comic Town</span>
        </Link>
        <Link className="map-region map-region--dock" href="/discover?category=culture">
          <MessageCircle aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>Talk Harbor</span>
        </Link>
        <span className="route-line route-line--one" />
        <span className="route-line route-line--two" />
        <span className="route-line route-line--three" />

        {mapPins.map((pin, index) => (
          <Link
            className={index === 0 ? "dungeon-pin is-active" : "dungeon-pin"}
            href={`/discover?q=${encodeURIComponent(pin.title)}`}
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
          </Link>
        ))}
      </div>

      <div className="daily-grid">
        {dailyDungeons.map((dungeon) => (
          <Link
            className="quest-card"
            href={`/discover?q=${encodeURIComponent(dungeon.title)}`}
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
          </Link>
        ))}
      </div>
    </section>
  );
}
