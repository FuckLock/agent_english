import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookMarked, Trophy } from "lucide-react";

import { StartBattleButton } from "@/components/battle/start-battle-button";
import { ComicReadingColumn } from "@/components/lesson/comic-reading-column";
import { LessonAudioPlayer } from "@/components/lesson/lesson-audio-player";
import {
  getLessonPageModel,
  getOrCreateStoryLessonFromSource
} from "@/server/lessons/lesson-service";

export const dynamic = "force-dynamic";

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params;

  if (lessonId.startsWith("source-")) {
    const lesson = getOrCreateStoryLessonFromSource(lessonId);
    if (!lesson) notFound();
    redirect(`/lessons/${lesson.id}`);
  }

  const lesson = getLessonPageModel(lessonId);
  if (!lesson) notFound();

  return (
    <main className="lesson-shell">
      <header className="lesson-topbar">
        <Link href="/discover">
          <ArrowLeft aria-hidden="true" size={17} />
          返回发现
        </Link>
        <span>
          {lesson.title} · {lesson.level} · {lesson.panels.length} 格分镜
        </span>
      </header>

      <div className="lesson-mobile-challenge" aria-label="移动端副本入口">
        <StartBattleButton dungeonId={lesson.dungeonId} lessonId={lesson.id} />
      </div>

      <div className="lesson-grid">
        <ComicReadingColumn lesson={lesson} />

        <aside className="lesson-side-panel" aria-label="副本挑战信息">
          <div>
            <p className="section-kicker section-kicker--dark">Quest Goal</p>
            <h2>阅读不是终点</h2>
            <p>{lesson.objectiveText}</p>
          </div>

          <StartBattleButton dungeonId={lesson.dungeonId} lessonId={lesson.id} />

          <LessonAudioPlayer
            canUseTts={lesson.canUseTts}
            disclosure={lesson.ttsDisclosure}
            error={lesson.ttsError}
            lessonId={lesson.id}
            status={lesson.ttsStatus}
          />

          <section className="lesson-equipment-card" aria-label="可用表达">
            <BookMarked aria-hidden="true" size={18} />
            <div>
              <strong>可收藏表达</strong>
              {lesson.expressions.slice(0, 2).map((item) => (
                <span key={item.expression}>{item.expression}</span>
              ))}
            </div>
          </section>

          <section className="lesson-stats-card" aria-label="今日生成任务">
            <Trophy aria-hidden="true" size={18} />
            <div>
              <strong>今日任务</strong>
              <span>{lesson.generationStats.total} 个生成任务</span>
              <span>{lesson.generationStats.skipped} 个无图降级</span>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
