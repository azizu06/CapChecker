/**
 * Seed the Supabase catalog with the fixture Verified Feed items.
 *
 * Usage (requires SUPABASE env vars, including the service-role key):
 *   npx tsx scripts/seed-feed.ts
 *   # or: node --experimental-strip-types scripts/seed-feed.ts
 *
 * The upsert is keyed on youtube_video_id, so re-running is safe.
 */
import { FIXTURE_CATALOG_ITEMS } from "../src/fixtures/feed";
import { createSupabaseCatalogRepository } from "../src/server/feed/supabase-catalog-repository";

async function main() {
  if (
    !(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    ) ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Seeding requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const repository = createSupabaseCatalogRepository();

  for (const item of FIXTURE_CATALOG_ITEMS) {
    const { inserted } = await repository.upsertItem(item);
    console.log(
      `${inserted ? "inserted" : "updated"} ${item.youtubeVideoId} — ${item.title}`,
    );
  }

  console.log(`Seeded ${FIXTURE_CATALOG_ITEMS.length} catalog item(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
