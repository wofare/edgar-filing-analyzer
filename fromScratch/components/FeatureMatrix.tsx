export function FeatureMatrix() {
  return (
    <section className="section" aria-labelledby="feature-title">
      <h2 id="feature-title" className="section-title">
        Built for money makers
      </h2>
      <p className="section-description">
        PulseShift crushes the clunky PDF chase. It turns the SEC feed into a responsive surface
        with live-change heatmaps, context, and playbooks tailored for fast-moving desks.
      </p>

      <div className="card-grid columns-3" style={{ marginTop: "2.6rem" }}>
        <div className="glass-card gradient-border" style={{ borderRadius: "22px" }}>
          <span className="badge badge--alert">
            <span className="badge-dot" /> Alerting engine
          </span>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", marginBottom: "0.8rem" }}>
            Blazing-fast filing radar
          </h3>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            We ingest the SEC feed in real time, detect the delta, and bubble up what changed. No
            more reloading the same page or losing hours to PDF spelunking.
          </p>
          <ul style={{ marginTop: "1.5rem", paddingLeft: "1.1rem", color: "rgba(255,255,255,0.75)", display: "grid", gap: "0.6rem" }}>
            <li>Intelligent duplicate suppression &amp; 8-K/10-Q priority mode.</li>
            <li>Form stack context so you can see prior events instantly.</li>
            <li>Upgrade for automated diff narratives delivered to Slack/SMS.</li>
          </ul>
        </div>

        <div className="glass-card gradient-border" style={{ borderRadius: "22px" }}>
          <span className="badge">
            <span className="badge-dot" /> Context engine
          </span>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", marginBottom: "0.8rem" }}>
            Visual storytelling
          </h3>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Filing heat levels, diff ribbons, and optional AI commentary help you evaluate relevance
            in seconds. It feels like a trading game — but the score is alpha.
          </p>
          <div className="tag-list" style={{ marginTop: "1.5rem" }}>
            <span className="tag-chip">Color-coded anomalies</span>
            <span className="tag-chip">Historical streaks</span>
            <span className="tag-chip">Sector impact meter</span>
            <span className="tag-chip">Narrative builder</span>
          </div>
        </div>

        <div className="glass-card gradient-border" style={{ borderRadius: "22px" }}>
          <span className="badge" style={{ background: "rgba(0, 245, 160, 0.2)", color: "var(--success)" }}>
            <span className="badge-dot" /> Automation ready
          </span>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", marginBottom: "0.8rem" }}>
            Designed to print
          </h3>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Export new filings to spreadsheets, build rules that push them into Notion, or feed them
            to your custom quant models. Your data stays ready to plug into the stack you already
            love.
          </p>
          <ul style={{ marginTop: "1.5rem", paddingLeft: "1.1rem", color: "rgba(255,255,255,0.75)", display: "grid", gap: "0.6rem" }}>
            <li>Webhook &amp; Zapier hooks for premium accounts.</li>
            <li>Granular filtering by form type, keywords, insiders.</li>
            <li>CSV/XLS export, research digests, and saved playbooks.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
