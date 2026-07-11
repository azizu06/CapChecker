import { z } from "zod";

import { HttpUrlSchema, ScorecardSchema } from "./analysis";

/**
 * Verified Feed contract. Every field is the camelCase mirror of a
 * `capcheck_catalog_items` / `capcheck_refresh_runs` row. This is the shared
 * boundary between the persistence layer and the UI — persisted live results,
 * seed data, and test fixtures all flow through these schemas.
 */

export const FEED_CATEGORIES = [
  "investing",
  "credit",
  "taxes",
  "budgeting",
  "retirement",
] as const;

export const CatalogCategorySchema = z.enum(FEED_CATEGORIES);
export type CatalogCategory = z.infer<typeof CatalogCategorySchema>;

export const CapLabelSchema = z.enum(["no-cap", "some-cap", "full-of-cap"]);
export type CapLabel = z.infer<typeof CapLabelSchema>;

export const CatalogItemSchema = z
  .object({
    id: z.string().min(1),
    youtubeVideoId: z.string().min(1),
    url: HttpUrlSchema.nullable(),
    title: z.string().min(1),
    channelTitle: z.string().min(1),
    thumbnailUrl: HttpUrlSchema,
    durationSeconds: z.number().int().nonnegative().nullable(),
    category: CatalogCategorySchema,
    tldr: z.string().min(1),
    capScore: z.number().int().min(0).max(100),
    capLabel: CapLabelSchema,
    scorecard: ScorecardSchema,
    analyzedAt: z.iso.datetime(),
  })
  .superRefine((item, context) => {
    // The denormalized cap fields must never drift from the embedded scorecard.
    if (item.capScore !== item.scorecard.capScore) {
      context.addIssue({
        code: "custom",
        path: ["capScore"],
        message: "capScore must match the embedded scorecard capScore",
      });
    }
    if (item.capLabel !== item.scorecard.capLabel) {
      context.addIssue({
        code: "custom",
        path: ["capLabel"],
        message: "capLabel must match the embedded scorecard capLabel",
      });
    }
  });

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const RefreshRunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
]);
export type RefreshRunStatus = z.infer<typeof RefreshRunStatusSchema>;

export const RefreshRunSchema = z.object({
  id: z.string().min(1),
  status: RefreshRunStatusSchema,
  discoveredCount: z.number().int().nonnegative(),
  analyzedCount: z.number().int().nonnegative(),
  keptCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});

export type RefreshRun = z.infer<typeof RefreshRunSchema>;

export const CAP_LABELS: Record<CapLabel, string> = {
  "no-cap": "No cap",
  "some-cap": "Some cap",
  "full-of-cap": "Full of cap",
};

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  investing: "Investing",
  credit: "Credit",
  taxes: "Taxes",
  budgeting: "Budgeting",
  retirement: "Retirement",
};
