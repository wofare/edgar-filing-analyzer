export function SocialProof() {
  return (
    <section className="section" aria-labelledby="proof-title">
      <div className="gradient-border" style={{ padding: "2.8rem", borderRadius: "24px", position: "relative" }}>
        <div className="grid-overlay" aria-hidden="true" />
        <h2 id="proof-title" className="section-title" style={{ marginBottom: "1rem" }}>
          Trusted by pros &amp; obsessed hobbyists
        </h2>
        <p className="section-description">
          From funds moving size to after-hours gladiators — PulseShift keeps teams synced on what
          actually moved the market. Addictive? Yes. Useful? Absolutely.
        </p>
        <div className="card-grid columns-3" style={{ marginTop: "2.8rem" }}>
          <figure className="glass-card" style={{ borderRadius: "20px", background: "rgba(11, 0, 30, 0.75)", padding: "1.8rem" }}>
            <blockquote style={{ margin: 0, fontSize: "1rem", lineHeight: 1.7 }}>
              “The neon heatmaps have our junior traders glued to real signals instead of chasing
              rumors. We shaved 15 minutes off our 8-K reaction workflow.”
            </blockquote>
            <figcaption style={{ marginTop: "1.3rem", color: "var(--accent-alt)", fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
              L. Chen — Director of Research, Velocity Alpha
            </figcaption>
          </figure>
          <figure className="glass-card" style={{ borderRadius: "20px", background: "rgba(11, 0, 30, 0.75)", padding: "1.8rem" }}>
            <blockquote style={{ margin: 0, fontSize: "1rem", lineHeight: 1.7 }}>
              “As a solo trader I can finally keep pace with funds. PulseShift Pro + SMS bursts means
              I don’t miss a filing even when I’m grabbing coffee.”
            </blockquote>
            <figcaption style={{ marginTop: "1.3rem", color: "var(--accent)", fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
              Mara B. — Options trader &amp; community leader
            </figcaption>
          </figure>
          <figure className="glass-card" style={{ borderRadius: "20px", background: "rgba(11, 0, 30, 0.75)", padding: "1.8rem" }}>
            <blockquote style={{ margin: 0, fontSize: "1rem", lineHeight: 1.7 }}>
              “Compliance loves the audit trail. Our traders love the dopamine of a clean diff feed.
              PulseShift is the first EDGAR tool our desk actually enjoys opening.”
            </blockquote>
            <figcaption style={{ marginTop: "1.3rem", color: "var(--accent-warm)", fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
              S. Patel — COO, ApexWave Capital
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
