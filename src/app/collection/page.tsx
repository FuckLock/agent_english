import Link from "next/link";
import { ArrowLeft, BookOpenText, Sword, Trophy } from "lucide-react";

import { EquipmentAlbum } from "@/components/collection/equipment-album";
import { MonsterRecords } from "@/components/collection/monster-records";
import { SkillTreePanel } from "@/components/collection/skill-tree-panel";
import { getCollectionModel } from "@/server/collection/collection-service";
import { isPrologueComplete, PROLOGUE_LESSON_ID } from "@/server/lessons/prologue-service";

export const dynamic = "force-dynamic";

export default function CollectionPage() {
  const collection = getCollectionModel();
  const prologueComplete = isPrologueComplete();

  return (
    <main className="collection-shell">
      <header className="collection-hero">
        <div>
          <p className="section-kicker">Collection</p>
          <h1>装备册与怪兽图鉴</h1>
          <p>看见自己收集到的表达、打过的怪兽和下一轮要复习的 Boss 线索。</p>
        </div>
        <Link className="settings-link-button" href="/">
          <ArrowLeft aria-hidden="true" size={17} />
          返回地图
        </Link>
      </header>

      <section className="collection-progress-strip" aria-label="学习记录总览">
        <span>
          <Trophy aria-hidden="true" size={17} />
          Lv. {collection.progress.level}
        </span>
        <span>{collection.progress.xp} XP</span>
        <span>{collection.savedExpressions.length} 个表达</span>
        <span>{collection.learningRecords.length} 条记录</span>
      </section>

      <div className="collection-grid">
        <section className="collection-panel prologue-entry" aria-label="序章副本">
          <div className="collection-panel__heading">
            <Sword aria-hidden="true" size={19} />
            <div>
              <p className="section-kicker">Prologue</p>
              <h2>序章副本</h2>
            </div>
          </div>
          <p>
            {prologueComplete
              ? "你已经通关序章，可以随时重打练手。"
              : "推荐先打序章，认识 Hello Sword 装备。"}
          </p>
          <Link
            className="settings-link-button settings-link-button--dark"
            href={`/lessons/${PROLOGUE_LESSON_ID}`}
          >
            {prologueComplete ? "重打序章" : "进入序章"}
          </Link>
        </section>

        <EquipmentAlbum collection={collection} />
        <MonsterRecords collection={collection} />
        <SkillTreePanel collection={collection} />

        <section className="collection-panel story-album" aria-label="漫画收藏">
          <div className="collection-panel__heading">
            <BookOpenText aria-hidden="true" size={19} />
            <div>
              <p className="section-kicker">Stories</p>
              <h2>漫画收藏</h2>
            </div>
          </div>
          {collection.storyCards.map((story) => (
            <Link href={`/lessons/${story.id}`} key={story.id}>
              <strong>{story.title}</strong>
              <span>
                {story.level} · {story.panelCount} 格 · {story.recordCount} 条记录
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
