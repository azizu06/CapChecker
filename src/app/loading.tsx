export default function FeedLoading() {
  return (
    <main className="feed-page" aria-busy="true">
      <div className="feed-state feed-loading" role="status" aria-live="polite">
        <div>
          <strong>Loading verified videos…</strong>
          <p>Checking the latest CapCheck-vetted catalog.</p>
        </div>
      </div>
    </main>
  );
}
