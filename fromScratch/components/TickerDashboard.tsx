"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

type FilingEntry = {
  accessionNumber: string;
  filingDate: string;
  filingType: string;
  formName: string;
  filingHref: string;
  summary: string;
  updated: string;
  size?: string;
  items?: string;
};

type FilingAnalytics = {
  filingsLast30Days: number;
  averageDaysBetweenFilings: number | null;
  formsBreakdown: { type: string; count: number }[];
  heatScore: number;
  changeVelocityLabel: string;
  lastUpdated: string;
  highlight: string;
};

type FilingResponse = {
  ticker: string;
  companyName: string;
  cik: string;
  entries: FilingEntry[];
  analytics: FilingAnalytics;
};

const STORAGE_KEYS = {
  tracked: "pulseshift:tracked-tickers",
  lastSeen: "pulseshift:last-seen",
};

const MAX_TICKERS_FREE = 3;

function formatDate(date: string) {
  try {
    return format(parseISO(date), "MMM d, yyyy");
  } catch (error) {
    return date;
  }
}

function computeNewCount(entries: FilingEntry[], lastSeen?: string) {
  if (!entries.length) return 0;
  if (!lastSeen) return entries.length;
  const lastSeenDate = parseISO(lastSeen);
  return entries.filter((entry) => {
    try {
      return parseISO(entry.filingDate) > lastSeenDate;
    } catch (error) {
      return false;
    }
  }).length;
}

function Sparkline({ entries }: { entries: FilingEntry[] }) {
  const points = useMemo(() => {
    if (!entries.length) return "";
    const now = new Date();
    const trimmed = entries.slice(0, 16);
    const reversed = [...trimmed].reverse();
    const values = reversed.map((entry) => {
      try {
        const days = Math.max(0, Math.min(30, differenceInCalendarDays(now, parseISO(entry.filingDate))));
        return 30 - days;
      } catch (error) {
        return 12;
      }
    });
    const max = Math.max(...values, 1);
    const widthStep = 100 / Math.max(values.length - 1, 1);
    return values
      .map((value, index) => {
        const x = index * widthStep;
        const y = 70 - (value / max) * 60 - 5;
        return `${x},${y}`;
      })
      .join(" ");
  }, [entries]);

  if (!points) {
    return (
      <div
        className="gradient-border"
        style={{
          height: "70px",
          borderRadius: "14px",
          display: "grid",
          placeItems: "center",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
        }}
      >
        No filings yet
      </div>
    );
  }

  return (
    <div className="gradient-border" style={{ padding: "0.9rem 1rem", borderRadius: "18px" }}>
      <svg className="sparkline" viewBox="0 0 100 70" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-alt)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="url(#sparklineGradient)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", fontSize: "0.75rem" }}>
        <span style={{ color: "var(--text-muted)" }}>30-day filing cadence</span>
        <span style={{ color: "var(--accent-alt)", fontFamily: "var(--font-display)" }}>Gamified velocity</span>
      </div>
    </div>
  );
}

export function TickerDashboard() {
  const [inputValue, setInputValue] = useState("");
  const [trackedTickers, setTrackedTickers] = useState<string[]>([]);
  const [filings, setFilings] = useState<Record<string, FilingResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTickers = window.localStorage.getItem(STORAGE_KEYS.tracked);
    const storedLastSeen = window.localStorage.getItem(STORAGE_KEYS.lastSeen);
    if (storedTickers) {
      try {
        const parsed = JSON.parse(storedTickers);
        if (Array.isArray(parsed)) {
          setTrackedTickers(parsed);
        }
      } catch (error) {
        console.error("Failed to parse tracked tickers", error);
      }
    }
    if (storedLastSeen) {
      try {
        const parsed = JSON.parse(storedLastSeen);
        setLastSeen(parsed);
      } catch (error) {
        console.error("Failed to parse last seen data", error);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.tracked, JSON.stringify(trackedTickers));
  }, [trackedTickers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.lastSeen, JSON.stringify(lastSeen));
  }, [lastSeen]);

  const fetchFilings = useCallback(
    async (ticker: string) => {
      const normalized = ticker.toUpperCase();
      setLoading((prev) => ({ ...prev, [normalized]: true }));
      setErrors((prev) => {
        const { [normalized]: _removed, ...rest } = prev;
        return rest;
      });
      try {
        const response = await fetch(`/api/filings?ticker=${encodeURIComponent(normalized)}`);
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error?.message ?? `Unable to load filings for ${normalized}`);
        }
        const payload = (await response.json()) as FilingResponse;
        setFilings((prev) => ({ ...prev, [normalized]: payload }));
      } catch (error) {
        console.error(error);
        setErrors((prev) => ({ ...prev, [normalized]: (error as Error).message }));
      } finally {
        setLoading((prev) => ({ ...prev, [normalized]: false }));
      }
    },
    []
  );

  useEffect(() => {
    trackedTickers.forEach((ticker) => {
      if (!filings[ticker] && !loading[ticker]) {
        void fetchFilings(ticker);
      }
    });
  }, [trackedTickers, filings, loading, fetchFilings]);

  const handleAddTicker = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim().toUpperCase();
      if (!trimmed) return;
      if (trackedTickers.includes(trimmed)) {
        setInputValue("");
        return;
      }
      if (trackedTickers.length >= MAX_TICKERS_FREE) {
        alert(
          `Free tier limited to ${MAX_TICKERS_FREE} tickers. Upgrade to PulseShift Pro to unlock unlimited watchlists, push alerts and AI narratives.`
        );
        return;
      }
      setTrackedTickers((prev) => [...prev, trimmed]);
      setInputValue("");
      void fetchFilings(trimmed);
    },
    [inputValue, trackedTickers, fetchFilings]
  );

  const handleRemoveTicker = useCallback((ticker: string) => {
    setTrackedTickers((prev) => prev.filter((item) => item !== ticker));
    setFilings((prev) => {
      const { [ticker]: _removed, ...rest } = prev;
      return rest;
    });
    setErrors((prev) => {
      const { [ticker]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const markAsReviewed = useCallback((ticker: string) => {
    const data = filings[ticker];
    if (!data || !data.entries.length) return;
    setLastSeen((prev) => ({ ...prev, [ticker]: data.entries[0].filingDate }));
  }, [filings]);

  const aggregated = useMemo(() => {
    const totals = trackedTickers.reduce(
      (acc, ticker) => {
        const data = filings[ticker];
        if (!data) return acc;
        const newCount = computeNewCount(data.entries, lastSeen[ticker]);
        acc.totalNew += newCount;
        acc.totalTracked += 1;
        acc.averageHeat += data.analytics.heatScore;
        return acc;
      },
      { totalNew: 0, totalTracked: 0, averageHeat: 0 }
    );
    if (totals.totalTracked) {
      totals.averageHeat = Math.round((totals.averageHeat / totals.totalTracked) * 10) / 10;
    }
    return totals;
  }, [trackedTickers, filings, lastSeen]);

  return (
    <section className="section" id="live-terminal" aria-labelledby="terminal-title">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <h2 id="terminal-title" className="section-title">
            Live change terminal
          </h2>
          <p className="section-description">
            Track the filings velocity of your watchlist. PulseShift highlights fresh forms, pace
            shifts, and patterns so you can trade with conviction instead of fear-of-missing-out.
          </p>
        </div>
        <div className="gradient-border" style={{ padding: "1.2rem 1.6rem", borderRadius: "18px", minWidth: "240px" }}>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Free tier telemetry
          </p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "2.1rem", margin: "0.3rem 0" }}>
            {aggregated.totalNew}
          </p>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>fresh filings waiting for review</p>
          <div className="neon-divider" />
          <p style={{ fontSize: "0.9rem", margin: 0 }}>
            Avg heat score: <span style={{ color: "var(--accent-alt)" }}>{aggregated.averageHeat || 0}</span>
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
            Upgrade for sentiment radar, SMS bursts and automated diff digests.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleAddTicker}
        className="gradient-border"
        style={{
          marginTop: "2.8rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          padding: "1rem 1.2rem",
          borderRadius: "20px",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 220px" }}>
          <label htmlFor="ticker-input" style={{ display: "block", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.18rem", color: "var(--text-muted)", marginBottom: "0.45rem" }}>
            Add ticker (ex: NVDA)
          </label>
          <input
            id="ticker-input"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value.toUpperCase())}
            placeholder="Type a symbol and press enter"
            style={{
              width: "100%",
              padding: "0.9rem 1rem",
              borderRadius: "14px",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              background: "rgba(5, 0, 18, 0.85)",
              color: "var(--text-primary)",
              fontSize: "1rem",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.12rem",
            }}
          />
        </div>
        <button type="submit" className="pulse-button">
          Track symbol
        </button>
        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "240px" }}>
          Free plan includes up to {MAX_TICKERS_FREE} simultaneous tickers. Premium unlocks unlimited
          watchlists, SMS nudge alerts, AI summary macros and automation recipes.
        </div>
      </form>

      <div className="card-grid" style={{ marginTop: "3rem" }}>
        {trackedTickers.length === 0 && (
          <div
            className="glass-card"
            style={{
              textAlign: "center",
              padding: "3rem",
              borderRadius: "22px",
              background: "linear-gradient(145deg, rgba(14, 0, 40, 0.9), rgba(9, 0, 24, 0.92))",
            }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", marginBottom: "0.8rem" }}>
              Build your first watchlist
            </p>
            <p style={{ color: "var(--text-muted)", maxWidth: "460px", margin: "0 auto 1.6rem" }}>
              Try TSLA, AMD or PLTR to feel the velocity. We pull the SEC feed live so you can see
              the filings stack up without leaving the page.
            </p>
            <div className="premium-gate">
              <span className="badge-dot" style={{ background: "var(--accent)" }} />
              Upgrade to unlock SMS and Discord hooks, custom color themes, and AI diff narrators.
            </div>
          </div>
        )}

        {trackedTickers.map((ticker) => {
          const tickerData = filings[ticker];
          const tickerError = errors[ticker];
          const isLoading = loading[ticker];
          const newCount = tickerData ? computeNewCount(tickerData.entries, lastSeen[ticker]) : 0;

          return (
            <article key={ticker} className="glass-card gradient-border" style={{ borderRadius: "24px" }}>
              <header style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.4rem",
                        letterSpacing: "0.18em",
                      }}
                    >
                      {ticker}
                    </span>
                    {newCount > 0 ? (
                      <span className="badge badge--alert">
                        <span className="badge-dot" /> {newCount} new
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "rgba(0, 245, 160, 0.18)", color: "var(--success)" }}>
                        On pace
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0.6rem 0 0", color: "var(--text-muted)" }}>
                    {tickerData?.companyName ?? "Loading company profile..."}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => markAsReviewed(ticker)}
                    className="pulse-button"
                    style={{
                      background: newCount > 0 ? "linear-gradient(120deg, rgba(0, 245, 160, 0.95), rgba(45, 226, 255, 0.85))" : undefined,
                      fontSize: "0.75rem",
                      padding: "0.7rem 1.2rem",
                    }}
                  >
                    Mark reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveTicker(ticker)}
                    style={{
                      background: "rgba(247, 37, 133, 0.14)",
                      color: "var(--accent)",
                      borderRadius: "14px",
                      padding: "0.65rem 1rem",
                      border: "1px solid rgba(247, 37, 133, 0.35)",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.12rem",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </header>

              <div className="neon-divider" />

              {isLoading && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Fetching live SEC feed…</p>
              )}

              {tickerError && (
                <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{tickerError}</p>
              )}

              {tickerData && !tickerError && (
                <div className="card-grid columns-2" style={{ marginTop: "1.6rem" }}>
                  <div>
                    <p style={{ textTransform: "uppercase", letterSpacing: "0.18rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Latest filings
                    </p>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0.8rem 0 0", display: "grid", gap: "0.9rem" }}>
                      {tickerData.entries.slice(0, 5).map((entry) => {
                        const entryDate = formatDate(entry.filingDate);
                        const isNew = !lastSeen[ticker] || parseISO(entry.filingDate) > parseISO(lastSeen[ticker]);
                        return (
                          <li
                            key={entry.accessionNumber}
                            className="gradient-border"
                            style={{
                              padding: "0.9rem 1.1rem",
                              borderRadius: "18px",
                              background: isNew
                                ? "linear-gradient(135deg, rgba(45, 226, 255, 0.16), rgba(247, 37, 133, 0.1))"
                                : "rgba(9, 0, 28, 0.75)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                              <a
                                href={entry.filingHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontFamily: "var(--font-display)",
                                  color: "var(--text-primary)",
                                  letterSpacing: "0.08rem",
                                }}
                              >
                                {entry.filingType}
                              </a>
                              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{entryDate}</span>
                            </div>
                            <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                              {entry.formName}
                            </p>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
                              {entry.summary}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div style={{ display: "grid", gap: "1rem" }}>
                    <Sparkline entries={tickerData.entries} />
                    <div className="gradient-border" style={{ padding: "1rem 1.3rem", borderRadius: "18px" }}>
                      <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.16rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        Velocity insight
                      </p>
                      <p style={{ fontSize: "1.25rem", margin: "0.55rem 0", fontFamily: "var(--font-display)" }}>
                        {tickerData.analytics.changeVelocityLabel}
                      </p>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {tickerData.analytics.highlight}
                      </p>
                      <div className="tag-list" style={{ marginTop: "0.85rem" }}>
                        {tickerData.analytics.formsBreakdown.slice(0, 4).map((item) => (
                          <span key={item.type} className="tag-chip">
                            {item.type} · {item.count}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="gradient-border" style={{ padding: "1rem 1.3rem", borderRadius: "18px" }}>
                      <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.16rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        Premium unlocks
                      </p>
                      <ul style={{ margin: "0.65rem 0 0", paddingLeft: "1.1rem", color: "var(--text-muted)", fontSize: "0.85rem", display: "grid", gap: "0.45rem" }}>
                        <li>Intraday filing diff highlights with AI commentary.</li>
                        <li>SMS, Discord and webhook burst alerts.</li>
                        <li>Historical pattern search and export to CSV/Notion.</li>
                      </ul>
                      <a
                        href="#pricing"
                        style={{
                          display: "inline-flex",
                          marginTop: "0.9rem",
                          color: "var(--accent-alt)",
                          fontFamily: "var(--font-display)",
                          letterSpacing: "0.1rem",
                        }}
                      >
                        Upgrade to Pro →
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
