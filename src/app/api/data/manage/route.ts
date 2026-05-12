import { NextResponse } from "next/server";
import { z } from "zod";

import {
  clearLearningRecords,
  deleteStoryLessonCascade
} from "@/server/data/data-management-service";
import { getDataManagementSummary } from "@/server/data/export-service";

const dataManageSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clear_learning_records") }),
  z.object({ action: z.literal("delete_story_lesson"), lessonId: z.string().trim().min(1) })
]);

export async function GET() {
  return NextResponse.json({ ok: true, data: getDataManagementSummary() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = dataManageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "数据管理参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.action === "clear_learning_records") {
    return NextResponse.json({ ok: true, data: clearLearningRecords() });
  }

  const data = deleteStoryLessonCascade(parsed.data.lessonId);
  if (!data) {
    return NextResponse.json({ ok: false, error: "未找到学习卡。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}
