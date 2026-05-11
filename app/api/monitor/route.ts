import { NextRequest, NextResponse } from "next/server";
import { readState, writeState, formatDateRu } from "@/lib/monitor-store";
import {
  scrapeCourt, scrapeCourtDecisions, scrapeHearingSchedule,
  scrapeCompany, scrapeEstitor, scrapeCadastre, checkGeneric
} from "@/lib/scrapers";

type ScraperFn = (prev?: Record<string, string | number | null>) => Promise<{
  ok: boolean; ms: number; status: number | null;
  extracted: Record<string, string | number | null>;
  summary: string; changed: boolean;
}>;

function getScraperFor(id: string, url: string): ScraperFn {
  if (id === "court_pscg")    return scrapeCourt;
  if (id === "court_odluke")  return scrapeCourtDecisions;
  if (id === "court_rocista") return scrapeHearingSchedule;
  if (id === "crps_search")   return scrapeCompany;
  if (id === "estitor")       return scrapeEstitor;
  if (id === "katastar_e")    return scrapeCadastre;
  return (prev) => checkGeneric(url, prev);
}

export async function GET() {
  return NextResponse.json(readState());
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sourceId?: string; url?: string;
    checkAll?: boolean; sources?: Array<{ id: string; url: string }>;
  };
  const state = readState();

  if (body.checkAll && body.sources) {
    const results = await Promise.allSettled(
      body.sources.map(async (s) => {
        const prev = state.sources[s.id]?.extracted;
        const r = await getScraperFor(s.id, s.url)(prev);
        return { id: s.id, ...r };
      })
    );

    for (const res of results) {
      if (res.status === "fulfilled") {
        const { id, ok, ms, status, extracted, summary, changed } = res.value;
        state.sources[id] = {
          lastChecked: new Date().toISOString(),
          status: extracted?.botBlocked === 1 ? "slow" : ok ? (ms > 6000 ? "slow" : "ok") : "error",
          httpStatus: status, responseMs: ms,
          note: summary, extracted, changed,
        };
      }
    }
    state.updatedAt = new Date().toISOString();
    writeState(state);
    return NextResponse.json({ ok: true, updatedAt: formatDateRu(state.updatedAt), sources: state.sources });
  }

  if (body.sourceId && body.url) {
    const prev = state.sources[body.sourceId]?.extracted;
    const r = await getScraperFor(body.sourceId, body.url)(prev);
    state.sources[body.sourceId] = {
      lastChecked: new Date().toISOString(),
      status: r.extracted?.botBlocked === 1 ? "slow" : r.ok ? (r.ms > 6000 ? "slow" : "ok") : "error",
      httpStatus: r.status, responseMs: r.ms,
      note: r.summary, extracted: r.extracted, changed: r.changed,
    };
    state.updatedAt = new Date().toISOString();
    writeState(state);
    return NextResponse.json(state.sources[body.sourceId]);
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
