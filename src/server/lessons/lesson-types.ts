import type { StoryLessonDraft } from "@/server/ai/story-lesson-generator";
import type { getTodayGenerationStats } from "@/server/generation/generation-job-runner";

export type LessonPanelView = {
  id: string;
  order: number;
  englishText: string;
  chineseHint: string;
  explanationZh: string;
  imagePrompt: string;
  imageStatus: string;
  imageUrl: string | null;
  expression: string;
  meaningZh: string;
  jobStatus: string | null;
  jobError: string | null;
};

export type LessonPageModel = {
  id: string;
  title: string;
  level: string;
  summaryZh: string;
  objectiveText: string;
  fullText: string;
  fullTextFolded: boolean;
  coverPrompt: string;
  coverImageUrl: string | null;
  coverJobStatus: string | null;
  coverJobError: string | null;
  panels: LessonPanelView[];
  expressions: StoryLessonDraft["expressions"];
  ttsDisclosure: string;
  ttsStatus: string | null;
  ttsError: string | null;
  canUseTts: boolean;
  canGenerateImages: boolean;
  generationStats: ReturnType<typeof getTodayGenerationStats>;
  dungeonId: string | null;
  isPrologue: boolean;
};
