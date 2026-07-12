export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <h2 id="how-title">How the Cap Score works</h2>
      <div className="how-grid">
        <div>
          <span className="step-kicker">Step 01</span>
          <b>Claims get extracted</b>
          <p>
            CapCheck transcribes the video and pulls out every checkable
            statement — facts and predictions, with timestamps.
          </p>
        </div>
        <div>
          <span className="step-kicker">Step 02</span>
          <b>Evidence gets checked</b>
          <p>
            Primary evidence is preferred. Evidence may be high, medium, or
            low trust—or unavailable.
          </p>
        </div>
        <div>
          <span className="step-kicker">Step 03</span>
          <b>The score adds up</b>
          <p>
            Verdict weights determine the score. Prediction-heavy videos have
            a minimum score of 30; hype is shown separately and does not add points.
          </p>
        </div>
      </div>
      <footer className="app-footer">
        <span className="disclaimer">
          CapCheck verifies claims — it isn&rsquo;t financial advice.
        </span>
        <span>© 2026</span>
      </footer>
    </section>
  );
}
