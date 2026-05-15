import { BookOpenText, ChevronDown, Sparkles, Swords } from "lucide-react";

import { GenerationActionButton } from "@/components/lesson/generation-action-button";
import { ComicArtPlaceholder, ImageJobStatus } from "@/components/lesson/image-job-status";
import { SaveExpressionButton } from "@/components/lesson/save-expression-button";
import type { LessonPageModel, LessonPanelView } from "@/server/lessons/lesson-service";

const DEFAULT_PANEL_COUNT = 6;
const MAX_PANEL_COUNT = 8;

type ComicReadingColumnProps = {
  lesson: LessonPageModel;
};

export function ComicReadingColumn({ lesson }: ComicReadingColumnProps) {
  return (
    <section className="lesson-reading-column" aria-labelledby="lesson-title">
      <div className="lesson-cover">
        {lesson.coverImageUrl ? (
          <img alt={`${lesson.title} 封面`} src={lesson.coverImageUrl} />
        ) : (
          <ComicArtPlaceholder label={`${lesson.title} 封面`} prompt={lesson.coverPrompt} />
        )}
        {lesson.isPrologue ? null : (
          <ImageJobStatus
            canGenerateImages={lesson.canGenerateImages}
            error={lesson.coverJobError}
            lessonId={lesson.id}
            status={lesson.coverJobStatus}
          />
        )}
      </div>

      <div className="lesson-intro">
        <p className="section-kicker">Comic Quest</p>
        <h1 id="lesson-title">{lesson.title}</h1>
        <p>{lesson.summaryZh}</p>
      </div>

      <div className="comic-panel-list">
        {lesson.panels.map((panel) => (
          <ComicPanelCard
            canGenerateImages={lesson.canGenerateImages}
            key={panel.id}
            lessonId={lesson.id}
            panel={panel}
          />
        ))}
      </div>

      {lesson.isPrologue ? null : (
        <div className="lesson-expand-card">
          <div>
            <Sparkles aria-hidden="true" size={18} />
            <strong>
              {lesson.panels.length >= DEFAULT_PANEL_COUNT ? "默认 6 格漫画已完整" : "正在补齐默认 6 格"}
            </strong>
            <span>短内容至少 4 格；想多看剧情时可手动扩展第 7-8 格，避免图片成本失控。</span>
          </div>
          {lesson.panels.length < MAX_PANEL_COUNT ? (
            <GenerationActionButton action="extend_panels" lessonId={lesson.id}>
              扩展第 {lesson.panels.length + 1} 格
            </GenerationActionButton>
          ) : null}
        </div>
      )}

      <details className="full-text-fold" open={!lesson.fullTextFolded}>
        <summary>
          <BookOpenText aria-hidden="true" size={17} />
          完整英文原文
          <ChevronDown aria-hidden="true" size={16} />
        </summary>
        <p>{lesson.fullText}</p>
      </details>
    </section>
  );
}

function ComicPanelCard({
  canGenerateImages,
  lessonId,
  panel
}: {
  canGenerateImages: boolean;
  lessonId: string;
  panel: LessonPanelView;
}) {
  return (
    <article className="comic-panel-card">
      {panel.imageUrl ? (
        <img alt={`Panel ${panel.order}`} src={panel.imageUrl} />
      ) : (
        <ComicArtPlaceholder label={`Panel ${panel.order}`} prompt={panel.imagePrompt} />
      )}

      <div className="comic-panel-card__body">
        <div className="comic-panel-card__top">
          <span>Panel {panel.order}/{panel.order > DEFAULT_PANEL_COUNT ? MAX_PANEL_COUNT : DEFAULT_PANEL_COUNT}</span>
          <ImageJobStatus
            canGenerateImages={canGenerateImages}
            error={panel.jobError}
            lessonId={lessonId}
            status={panel.jobStatus ?? panel.imageStatus}
          />
        </div>
        <h2>{panel.englishText}</h2>
        <p>{panel.chineseHint}</p>
        <div className="sentence-explain">
          <strong>表达解释</strong>
          <span>{panel.explanationZh}</span>
        </div>
        <div className="expression-row">
          <Swords aria-hidden="true" size={15} />
          <span>{panel.expression}</span>
          <SaveExpressionButton
            expression={panel.expression}
            lessonId={lessonId}
            meaningZh={panel.meaningZh}
            sourceText={panel.englishText}
          />
        </div>
      </div>
    </article>
  );
}
