export function Hero() {
  return (
    <section className="section" aria-labelledby="hero-title">
      <div className="glass-card gradient-border" style={{ overflow: "hidden" }}>
        <div className="grid-overlay" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <span className="badge">
          <span className="badge-dot" /> Ignite every filing drop
        </span>
        <h1
          id="hero-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.75rem, 4vw + 1rem, 4.4rem)",
            margin: "1.2rem 0 1.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          PulseShift turns EDGAR chaos into neon clarity
        </h1>
        <p className="section-description" style={{ fontSize: "1.15rem", maxWidth: "760px" }}>
          One cockpit for day traders and desk analysts who need to know the moment a filing
          hits. Track unlimited tickers, see what changed, and get a visual pulse on market-moving
          paperwork in seconds.
        </p>
        <div className="tag-list" style={{ margin: "1.8rem 0 2.4rem" }}>
          <span className="tag-chip">Live SEC feed</span>
          <span className="tag-chip">Diff visualizations</span>
          <span className="tag-chip">Sentiment scoring</span>
          <span className="tag-chip">AI-ready exports</span>
          <span className="tag-chip">Mobile alerts</span>
          <span className="tag-chip">Desk-friendly dark mode</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.3rem", alignItems: "center" }}>
          <a className="pulse-button" href="#live-terminal">
            Launch live terminal
          </a>
          <div style={{ maxWidth: "240px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Start on the free lane. Upgrade when you're ready to unlock real-time diffing,
            sentiment alerts, and automation.
          </div>
        </div>
        <div
          style={{
            marginTop: "2.8rem",
            display: "grid",
            gap: "1.2rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <div>
            <span className="badge badge--alert">Pro insight</span>
            <p style={{ fontSize: "2.3rem", fontFamily: "var(--font-display)", margin: "0.6rem 0" }}>
              8m
            </p>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              Average reaction lead time when traders act on PulseShift alerts.
            </p>
          </div>
          <div>
            <span className="badge">Coverage</span>
            <p style={{ fontSize: "2.3rem", fontFamily: "var(--font-display)", margin: "0.6rem 0" }}>
              12,000+
            </p>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              Public tickers, SPACs, and funds with streaming filings.
            </p>
          </div>
          <div>
            <span className="badge" style={{ background: "rgba(255, 158, 44, 0.22)", color: "#ffdd9b" }}>
              Premium alpha
            </span>
            <p style={{ fontSize: "2.3rem", fontFamily: "var(--font-display)", margin: "0.6rem 0" }}>
              37%
            </p>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              Of surveyed users said PulseShift paid for itself within two trades.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
