import { NextResponse } from "next/server";
import { z } from "zod";

import { getCollectionModel, updateReviewStatus } from "@/server/collection/collection-service";

const reviewStatusSchema = z.object({
  action: z.literal("update_review_status"),
  id: z.string().trim().min(1),
  status: z.enum(["open", "done", "snoozed"])
});

export async function GET() {
  return NextResponse.json({ ok: true, collection: getCollectionModel() });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = reviewStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "收藏记录更新参数无效。", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const collection = updateReviewStatus({ id: parsed.data.id, status: parsed.data.status });
  if (!collection) {
    return NextResponse.json({ ok: false, error: "复习状态更新失败。" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, collection });
}
