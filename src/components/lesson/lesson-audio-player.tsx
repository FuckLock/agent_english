import { Headphones, MicOff, Volume2 } from "lucide-react";

import { GenerationActionButton } from "@/components/lesson/generation-action-button";

type LessonAudioPlayerProps = {
  canUseTts: boolean;
  disclosure: string;
  error: string | null;
  lessonId: string;
  status: string | null;
};

export function LessonAudioPlayer({
  canUseTts,
  disclosure,
  error,
  lessonId,
  status
}: LessonAudioPlayerProps) {
  if (!canUseTts || status === "failed" || status === "skipped") {
    return (
      <section className="lesson-audio lesson-audio--muted" aria-label="英文朗读">
        <MicOff aria-hidden="true" size={20} />
        <div>
          <strong>英文朗读暂不可用</strong>
          <span>{error ?? "TTS Provider 未配置，先自行朗读英文短句。"}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="lesson-audio" aria-label="英文朗读">
      <Headphones aria-hidden="true" size={20} />
      <div>
        <strong>英文 TTS 朗读</strong>
        <span>{disclosure}</span>
      </div>
      {status === "succeeded" ? (
        <button className="audio-play-button" type="button">
          <Volume2 aria-hidden="true" size={16} />
          播放
        </button>
      ) : (
        <GenerationActionButton action="queue_tts" lessonId={lessonId}>
          {status === "pending" ? "查看朗读任务" : "生成朗读"}
        </GenerationActionButton>
      )}
    </section>
  );
}
