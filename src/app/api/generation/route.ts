import { NextResponse } from "next/server";
import { z } from "zod";

import {
  extendLessonPanels,
  queueLessonAudioJob,
  retryLessonImageJobs
} from "@/server/lessons/lesson-service";

const generationRequestSchema = z.object({
  action: z.enum(["extend_panels", "retry_images", "queue_tts"]),
  lessonId: z.string().min(1),
  quality: z.enum(["draft", "standard", "high"]).optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = generationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "生成任务参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { action, lessonId, quality = "draft" } = parsed.data;
  const lesson =
    action === "extend_panels"
      ? extendLessonPanels(lessonId, quality)
      : action === "retry_images"
        ? retryLessonImageJobs(lessonId, quality)
        : queueLessonAudioJob(lessonId);

  if (!lesson) {
    return NextResponse.json({ ok: false, error: "未找到学习卡。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson });
}
