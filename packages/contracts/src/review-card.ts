export const REVIEW_FEEDBACK_STATES = [
  "remembered",
  "fuzzy",
  "forgotten",
] as const;

export type ReviewFeedbackState = (typeof REVIEW_FEEDBACK_STATES)[number];

export interface ReviewCard {
  reviewCardId: string;
  savedItemId: string;
  prompt: string;
  answer: string;
  stage: string;
  createdAt: string;
  lastReviewedAt?: string;
  nextDueAt: string;
  feedbackState?: ReviewFeedbackState;
}
