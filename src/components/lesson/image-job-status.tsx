import { Image as ImageIcon } from "lucide-react";

import { GenerationActionButton } from "@/components/lesson/generation-action-button";
import { ImageFallbackState } from "@/components/states/image-fallback-state";

type ImageJobStatusProps = {
  canGenerateImages: boolean;
  error: string | null;
  lessonId: string;
  status: string | null;
};

export function ImageJobStatus({
  canGenerateImages,
  error,
  lessonId,
  status
}: ImageJobStatusProps) {
  const tone = getTone(status, canGenerateImages);

  return (
    <ImageFallbackState
      action={
        canGenerateImages && tone !== "ready" ? (
          <GenerationActionButton action="retry_images" lessonId={lessonId}>
            重试图片
          </GenerationActionButton>
        ) : null
      }
      detail={error}
      label={getLabel(status, canGenerateImages)}
      tone={tone}
    />
  );
}

export function ComicArtPlaceholder({ label, prompt }: { label: string; prompt: string }) {
  return (
    <div className="comic-art" aria-label={label}>
      <div className="comic-art__scene">
        <ImageIcon aria-hidden="true" size={28} strokeWidth={2.4} />
        <strong>{label}</strong>
        <span>{prompt}</span>
      </div>
    </div>
  );
}

function getTone(status: string | null, canGenerateImages: boolean) {
  if (status === "succeeded") return "ready";
  if (status === "pending" || status === "submitted" || status === "polling") return "pending";
  return canGenerateImages ? "failed" : "skipped";
}

function getLabel(status: string | null, canGenerateImages: boolean) {
  if (status === "succeeded") return "图片已完成";
  if (status === "pending") return "图片任务待提交";
  if (status === "submitted" || status === "polling") return "图片生成中";
  if (!canGenerateImages) return "无图降级，不阻断阅读";
  return "图片未完成";
}
