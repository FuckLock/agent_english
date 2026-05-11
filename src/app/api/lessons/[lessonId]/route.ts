import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getLessonPageModel,
  getOrCreateStoryLessonFromSource,
  saveLessonExpression
} from "@/server/lessons/lesson-service";

type LessonRouteContext = {
  params: Promise<{ lessonId: string }>;
};

const lessonPatchSchema = z.object({
  action: z.literal("save_expression"),
  expression: z.string().trim().min(1),
  meaningZh: z.string().trim().min(1),
  sourceText: z.string().trim().min(1)
});

export async function GET(_request: Request, context: LessonRouteContext) {
  const { lessonId } = await context.params;
  const id = lessonId.startsWith("source-")
    ? getOrCreateStoryLessonFromSource(lessonId)?.id
    : lessonId;

  if (!id) {
    return NextResponse.json({ ok: false, error: "未找到内容来源。" }, { status: 404 });
  }

  const lesson = getLessonPageModel(id);
  if (!lesson) {
    return NextResponse.json({ ok: false, error: "未找到学习卡。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson });
}

export async function PATCH(request: Request, context: LessonRouteContext) {
  const { lessonId } = await context.params;
  const body = await request.json();
  const parsed = lessonPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "学习卡更新参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!getLessonPageModel(lessonId)) {
    return NextResponse.json({ ok: false, error: "未找到学习卡。" }, { status: 404 });
  }

  const result = saveLessonExpression({
    lessonId,
    expression: parsed.data.expression,
    meaningZh: parsed.data.meaningZh,
    sourceText: parsed.data.sourceText
  });

  return NextResponse.json(result);
}
