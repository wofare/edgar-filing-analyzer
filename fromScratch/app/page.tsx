import { FeatureMatrix } from "../components/FeatureMatrix";
import { Hero } from "../components/Hero";
import { PricingSection } from "../components/PricingSection";
import { SocialProof } from "../components/SocialProof";
import { TickerDashboard } from "../components/TickerDashboard";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <TickerDashboard />
      <FeatureMatrix />
      <SocialProof />
      <PricingSection />

      <section className="section" aria-labelledby="cta-title">
        <div className="glass-card gradient-border" style={{ borderRadius: "26px", textAlign: "center", padding: "3rem" }}>
          <h2 id="cta-title" className="section-title" style={{ marginBottom: "0.6rem" }}>
            Ready to feel the filing rush?
          </h2>
          <p className="section-description" style={{ margin: "0 auto", maxWidth: "620px" }}>
            PulseShift makes EDGAR addictive. Add your watchlist, experience the neon filing radar,
            and graduate to premium when you need automation and alerts that never sleep.
          </p>
          <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center", gap: "1.4rem", flexWrap: "wrap" }}>
            <a className="pulse-button" href="#live-terminal">
              Try the live demo
            </a>
            <a
              className="pulse-button"
              href="#pricing"
              style={{ background: "linear-gradient(120deg, rgba(0, 245, 160, 0.9), rgba(45, 226, 255, 0.85))" }}
            >
              Compare plans
            </a>
          </div>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", marginTop: "1.6rem" }}>
            Live on web. Desktop + mobile native apps coming soon. API, Discord bot and quant feeds
            ship with PulseShift Pro &amp; Apex.
          </p>
        </div>
      </section>

      <footer style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", paddingBottom: "4rem" }}>
        © {new Date().getFullYear()} PulseShift Labs. Built for traders who chase the signal, not the
        noise.
      </footer>
    </main>
  );
}
