export function PricingSection() {
  return (
    <section className="section" id="pricing" aria-labelledby="pricing-title">
      <h2 id="pricing-title" className="section-title">
        Pricing engineered for upside
      </h2>
      <p className="section-description">
        Start free with real SEC data. When you are ready to automate, upgrade for instant diff
        alerts, AI commentary, and lightning-fast delivery channels that keep you ahead of the pack.
      </p>

      <div className="card-grid columns-3" style={{ marginTop: "3rem" }}>
        <div className="glass-card gradient-border" style={{ borderRadius: "22px", display: "grid", gap: "1.2rem" }}>
          <span className="badge">Starter</span>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: 0 }}>Free runway</h3>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Kick the tires with live filings.</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>$0</p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9rem", margin: 0 }}>forever</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.65rem", color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>
            <li>3 tickers in your live radar.</li>
            <li>Fresh filings feed with color-coded urgency.</li>
            <li>Local highlights &amp; manual notes.</li>
            <li>Export the last 15 filings per ticker.</li>
          </ul>
          <button className="pulse-button" style={{ width: "fit-content" }}>Launch free</button>
        </div>

        <div
          className="glass-card gradient-border"
          style={{
            borderRadius: "22px",
            display: "grid",
            gap: "1.2rem",
            position: "relative",
            background: "linear-gradient(160deg, rgba(28, 0, 70, 0.92), rgba(5, 0, 26, 0.96))",
            transform: "scale(1.02)",
          }}
        >
          <span className="badge badge--alert">
            <span className="badge-dot" /> Most loved
          </span>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: 0 }}>PulseShift Pro</h3>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Automation and alerts for active desks.</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>$89</p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9rem", margin: 0 }}>per seat / month</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.65rem", color: "rgba(255,255,255,0.85)", fontSize: "0.9rem" }}>
            <li>Unlimited tickers, saved views &amp; shared watchlists.</li>
            <li>Real-time diff engine with AI insights and sentiment scoring.</li>
            <li>SMS, email, Discord &amp; webhook delivery with throttling controls.</li>
            <li>Notebook exports, automation recipes, and compliance audit trail.</li>
          </ul>
          <button className="pulse-button" style={{ width: "fit-content" }}>Start 14-day pro pass</button>
          <div className="premium-gate">
            <span className="badge-dot" style={{ background: "var(--accent-alt)" }} />
            Cancel anytime. Annual billing saves 17% and unlocks concierge onboarding.
          </div>
        </div>

        <div className="glass-card gradient-border" style={{ borderRadius: "22px", display: "grid", gap: "1.2rem" }}>
          <span className="badge" style={{ background: "rgba(0, 245, 160, 0.2)", color: "var(--success)" }}>Elite desks</span>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: 0 }}>Apex</h3>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Purpose-built for prop shops &amp; funds.</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>Custom</p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.9rem", margin: 0 }}>annual partnership</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.65rem", color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>
            <li>Dedicated instance with ingestion SLAs and priority support.</li>
            <li>Private API access &amp; custom anomaly scoring.</li>
            <li>Compliance vault, insider team-level analytics, and SOC 2 reports.</li>
            <li>White-glove onboarding, data warehouse sync, custom colorways.</li>
          </ul>
          <button className="pulse-button" style={{ width: "fit-content" }}>Talk to sales</button>
        </div>
      </div>
    </section>
  );
}
