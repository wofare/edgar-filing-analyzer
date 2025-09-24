import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { parseStringPromise } from "xml2js";

const USER_AGENT = process.env.SEC_USER_AGENT ?? "PulseShift/1.0 (+contact@pulseshift.example)";

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

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value: string | undefined) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_" in value) {
    return safeText((value as { _: unknown })._);
  }
  return String(value);
}

function buildAnalytics(entries: FilingEntry[]): FilingAnalytics {
  if (!entries.length) {
    return {
      filingsLast30Days: 0,
      averageDaysBetweenFilings: null,
      formsBreakdown: [],
      heatScore: 0,
      changeVelocityLabel: "No filings yet",
      lastUpdated: "",
      highlight: "Add more tickers or wait for the next SEC event.",
    };
  }

  const now = new Date();
  const filingsLast30Days = entries.filter((entry) => {
    try {
      return differenceInCalendarDays(now, parseISO(entry.filingDate)) <= 30;
    } catch (error) {
      return false;
    }
  }).length;

  const diffs: number[] = [];
  for (let index = 0; index < entries.length - 1; index += 1) {
    try {
      const current = parseISO(entries[index].filingDate);
      const next = parseISO(entries[index + 1].filingDate);
      const diff = Math.abs(differenceInCalendarDays(current, next));
      if (!Number.isNaN(diff) && Number.isFinite(diff)) {
        diffs.push(diff);
      }
    } catch (error) {
      // ignore parsing issues
    }
  }

  const averageDaysBetweenFilings = diffs.length
    ? Math.round((diffs.reduce((total, value) => total + value, 0) / diffs.length) * 10) / 10
    : null;

  const counts = entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.filingType] = (accumulator[entry.filingType] ?? 0) + 1;
    return accumulator;
  }, {});

  const formsBreakdown = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const latestDate = entries[0]?.filingDate;
  let velocity: string;
  let highlight: string;
  let heatScore = Math.min(100, filingsLast30Days * 7 + (averageDaysBetweenFilings ? 30 - averageDaysBetweenFilings : 15));

  if (!latestDate) {
    velocity = "Awaiting filings";
    highlight = "We'll light up this board the moment a filing lands.";
  } else {
    const daysSinceLatest = Math.max(0, differenceInCalendarDays(now, parseISO(latestDate)));
    if (daysSinceLatest <= 1) {
      velocity = "Blazing — same day";
      highlight = "Fresh filing detected. Jump in before the market digests it.";
      heatScore += 15;
    } else if (daysSinceLatest <= 3) {
      velocity = "Hot — last 72h";
      highlight = "Recent filings available. Perfect for news-driven setups.";
      heatScore += 10;
    } else if (daysSinceLatest <= 7) {
      velocity = "Warm — last week";
      highlight = "A steady cadence. Track for trend confirmation or insider shifts.";
    } else {
      velocity = "Cooling — beyond 7 days";
      highlight = "Quiet stretch. Premium alerts will ping you when the next drop lands.";
      heatScore = Math.max(heatScore - 10, 0);
    }
  }

  heatScore = Math.round(Math.max(0, Math.min(100, heatScore)) * 10) / 10;

  return {
    filingsLast30Days,
    averageDaysBetweenFilings,
    formsBreakdown,
    heatScore,
    changeVelocityLabel: velocity,
    lastUpdated: latestDate ?? "",
    highlight,
  };
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ message: "Ticker parameter is required" }, { status: 400 });
  }

  const url = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  url.searchParams.set("action", "getcompany");
  url.searchParams.set("CIK", ticker);
  url.searchParams.set("owner", "exclude");
  url.searchParams.set("count", "60");
  url.searchParams.set("output", "atom");

  let rawXml: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/atom+xml, application/xml, text/xml",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { message: `SEC request failed with status ${response.status}` },
        { status: response.status }
      );
    }
    rawXml = await response.text();
  } catch (error) {
    console.error("Failed to query SEC", error);
    return NextResponse.json({ message: "Unable to reach SEC right now" }, { status: 502 });
  }

  let parsed: any;
  try {
    parsed = await parseStringPromise(rawXml, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });
  } catch (error) {
    console.error("Failed to parse SEC feed", error);
    return NextResponse.json({ message: "Unable to parse SEC response" }, { status: 500 });
  }

  const feed = parsed?.feed;
  if (!feed) {
    return NextResponse.json({ message: "Ticker not found" }, { status: 404 });
  }

  const companyInfo = feed["company-info"] ?? {};
  const companyName = safeText(companyInfo["conformed-name"]) || ticker;
  const cik = safeText(companyInfo.cik) || ticker;

  const entriesRaw = feed.entry ? asArray(feed.entry) : [];
  const entries: FilingEntry[] = entriesRaw
    .map((entry: any) => {
      const content = entry.content ?? {};
      const summaryRaw = safeText(entry.summary);
      const cleanedSummary = stripHtml(summaryRaw);
      const link = asArray(entry.link)[0]?.href ?? safeText(entry.link?.href);
      const filingDate = safeText(content["filing-date"]) || safeText(entry.updated)?.slice(0, 10);

      return {
        accessionNumber:
          safeText(content["accession-number"]) || safeText(entry.id)?.split("=").pop() || "",
        filingDate,
        filingType: safeText(content["filing-type"]) || safeText(entry.category?.term),
        formName: safeText(content["form-name"]) || safeText(entry.title),
        filingHref: safeText(content["filing-href"]) || link,
        summary: cleanedSummary,
        updated: safeText(entry.updated) || filingDate,
        size: safeText(content.size) || undefined,
        items: safeText(content["items-desc"]) || undefined,
      } satisfies FilingEntry;
    })
    .filter((entry: FilingEntry) => Boolean(entry.filingDate))
    .sort((a: FilingEntry, b: FilingEntry) => (a.filingDate > b.filingDate ? -1 : 1));

  const response: FilingResponse = {
    ticker,
    companyName,
    cik,
    entries,
    analytics: buildAnalytics(entries),
  };

  return NextResponse.json(response, { headers: { "Cache-Control": "max-age=120" } });
}
