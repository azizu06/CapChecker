import { z } from "zod";

import { FINANCE_CATEGORIES } from "./ports";

export const RefreshStageSchema = z.enum([
  "starting",
  "discovering",
  "screening",
  "analyzing",
  "saving",
  "done",
]);

export const RefreshCountsSchema = z.object({
  discovered: z.number().int().nonnegative(),
  analyzed: z.number().int().nonnegative(),
  kept: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  duplicate: z.number().int().nonnegative(),
});

export const AcceptedSummarySchema = z.object({
  youtubeVideoId: z.string().min(1),
  title: z.string(),
  category: z.enum(FINANCE_CATEGORIES),
  capScore: z.number().int(),
  tldr: z.string(),
  inserted: z.boolean(),
});

export const RefreshStageEventSchema = z.object({
  type: z.literal("stage"),
  stage: RefreshStageSchema,
  message: z.string().min(1),
});

export const RefreshCompleteEventSchema = z.object({
  type: z.literal("complete"),
  status: z.literal("completed"),
  counts: RefreshCountsSchema,
  accepted: AcceptedSummarySchema.nullable(),
});

export const RefreshErrorEventSchema = z.object({
  type: z.literal("error"),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
});

export const RefreshEventSchema = z.discriminatedUnion("type", [
  RefreshStageEventSchema,
  RefreshCompleteEventSchema,
  RefreshErrorEventSchema,
]);

export type RefreshStage = z.infer<typeof RefreshStageSchema>;
export type AcceptedSummary = z.infer<typeof AcceptedSummarySchema>;
export type RefreshStageEvent = z.infer<typeof RefreshStageEventSchema>;
export type RefreshCompleteEvent = z.infer<typeof RefreshCompleteEventSchema>;
export type RefreshErrorEvent = z.infer<typeof RefreshErrorEventSchema>;
export type RefreshEvent = z.infer<typeof RefreshEventSchema>;
