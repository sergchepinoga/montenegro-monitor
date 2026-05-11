import { NextResponse } from "next/server";
import { readState, writeState, formatDateRu } from "@/lib/monitor-store";
import { scrapeCourt, scrapeCourtDecisions, scrapeHearingSchedule, scrapeCompany, scrapeEstitor, scrapeCadastre, checkGeneric } from "@/lib/scrapers";
import { sendTelegram } from "@/lib/telegram";
import { randomUUID } from "crypto";

// SCHEDULE (Bratislava UTC+2 summer):
// Run 1: Vercel Cron  → 07:00 UTC = 09:00 Bratislava  (vercel.json: "0 7 * * *")
// Run 2: cron-job.org → 18:00 UTC = 20:00 Bratislava  (job #7589398)

const ALL_SOURCES = [
  { id: "court_odluke",  url: "https://sudovi.me/pscg/odluke/" },
  { id: "court_rocista", url: "https://sudovi.me/pscg/kategorija/Qa" },
  { id: "court_pscg",    url: "https://sudovi.me/pscg" },
  { id: "court_ascg",    url: "https://sudovi.me/ascg" },
  { id: "katastar_e",    url: "https://ekatastar.me" },
  { id: "geoportal",     url: "https://geoportal.co.me/geoportal/geoportal_eng.html" },
  { id: "katastar_gov",  url: "https://www.gov.me/en/upravazan-ekretnine" },
  { id: "mpa",           url: "https://www.gov.me/mpa" },
  { id: "crps_search",   url: "http://www.pretraga.crps.me" },
  { id: "irms",          url: "https://irms.tax.gov.me/public/search-register/business-entities" },
  { id: "efirma",        url: "http://efirma.tax.gov.me" },
  { id: "tax_pu",        url: "http://www.poreskauprava.gov.me" },
  { id: "tax_e",         url: "https://etaxes.tax.gov.me" },
  { id: "prosec_main",   url: "https://tuzilastvo.me" },
  { id: "police",        url: "https://www.upolicija.gov.me" },
  { id: "estitor",       url: "https://estitor.com/me-en/real-estates/purpose-sale/type-land-lot/city-budva/neighbourhood-becici" },
  { id: "investropa",    url: "https://investropa.com/blogs/news/montenegro-price-forecasts" },
  { id: "srbija_nek",    url: "https://www.srbija-nekretnine.org/en/plots/for-sale/budva" },
  { id: "lawyer",        url: "https://lawoffice-vujacic.com" },
];

type ScraperFn = (prev?: Record<string, string | number | null>) => Promise<{ ok: boolean; ms: number; status: number | null; extracted: Record<string, string | number | null>; summary: string; changed: boolean }>;

function getScraper(id: string, url: string): ScraperFn {
  if (id === "court_odluke")  return scrapeCourtDecisions;
  if (id === "court_rocista") return scrapeHearingSchedule;
  if (id === "court_pscg")    return scrapeCourt;
  if (id === "crps_search")   return scrapeCompany;
  if (id === "estitor")       return scrapeEstitor;
  if (id === "katastar_e")    return scrapeCadastre;
  return (prev) => checkGeneric(url, prev);
}

const CASE_PATTERNS: Record<string, string[]> = {
  "P.24/21":  ["P.24/21","P 24/21","24/21"],
  "P.596/22": ["P.596/22","P 596/22","596/22"],
  "P.785/22": ["P.785/22","P 785/22","785/22"],
  "UPI224/22":["UPI224","UPI-224"],
  "Kt.96/25": ["Kt.96/25","Kt 96/25","96/25","109/21"],
};

// Short titles for Telegram notifications
const CASE_TITLES: Record<string, string> = {
  "P.24/21":   "Исключение Банченко из Capital Plus DOO",
  "P.596/22":  "Отмена договора о совм. строительстве (возврат земли)",
  "P.785/22":  "Capital Plus vs Hrast CG — приостановлено",
  "UPI224/22": "Кадастровая отметка о судебном споре",
  "Kt.96/25":  "Уголовное дело против Банченко (мошенничество)",
};

const COURT_URLS = [
  "https://sudovi.me/pscg/odluke/",
  "https://sudovi.me/pscg/kategorija/Qa",
];

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 Chrome/124", "Accept": "text/html", "Accept-Language": "sr,ru;q=0.9,en;q=0.7" } });
    const html = await r.text();
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch { return null; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}` && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const state = readState();
  const now = new Date().toISOString();
  let sourcesChecked = 0, sourcesOk = 0, caseUpdatesAdded = 0;

  // 1. Check all sources
  const sourceResults = await Promise.allSettled(
    ALL_SOURCES.map(async (s) => {
      const prev = state.sources[s.id]?.extracted;
      const r = await getScraper(s.id, s.url)(prev);
      return { id: s.id, ...r };
    })
  );

  for (const res of sourceResults) {
    if (res.status === "fulfilled") {
      const { id, ok, ms, status, extracted, summary, changed } = res.value;
      state.sources[id] = {
        lastChecked: now,
        status: extracted?.botBlocked === 1 ? "slow" : ok ? (ms > 6000 ? "slow" : "ok") : "error",
        httpStatus: status, responseMs: ms, note: summary, extracted, changed,
      };
      sourcesChecked++;
      if (ok) sourcesOk++;

      if (changed && summary) {
        await sendTelegram(`📡 <b>Изменение обнаружено</b>\n${id}: ${summary.slice(0,200)}\n🕐 ${formatDateRu(now)}`);
      }
    }
  }

  // 2. Check each court case
  for (const [caseId, patterns] of Object.entries(CASE_PATTERNS)) {
    const findings: string[] = [];
    for (const courtUrl of COURT_URLS) {
      const text = await fetchText(courtUrl);
      if (!text) continue;
      for (const pat of patterns) {
        if (text.toLowerCase().includes(pat.toLowerCase())) {
          const idx = text.toLowerCase().indexOf(pat.toLowerCase());
          const ctx = text.slice(Math.max(0, idx - 100), idx + 200).trim();
          findings.push(`🔍 ${pat} найдено в ${courtUrl.includes("odluke") ? "базе решений" : "расписании"}: ${ctx.slice(0, 150)}`);
          break;
        }
      }
    }

    const agentKey = `case_${caseId.replace(/[./]/g, "_")}`;
    state.sources[agentKey] = {
      lastChecked: now, status: findings.length > 0 ? "ok" : "slow",
      httpStatus: 200, responseMs: 0,
      note: findings.length > 0 ? `✅ Найдено: ${findings[0].slice(0, 150)}` : `🔍 ${caseId} не найдено в публичной базе суда`,
    };

    if (findings.length > 0) {
      if (!state.caseUpdates[caseId]) state.caseUpdates[caseId] = [];
      const last = state.caseUpdates[caseId].find(u => u.source === "🤖 Агент");
      const newText = `🤖 Автопроверка агента:\n${findings.join("\n")}`;
      if (!last || last.text !== newText) {
        state.caseUpdates[caseId].unshift({ id: randomUUID(), date: now, dateRu: formatDateRu(now), text: newText, source: "🤖 Агент" });
        caseUpdatesAdded++;
        await sendTelegram(`⚖️ <b>Агент нашёл обновление!</b>

Дело: <b>${caseId} — ${CASE_TITLES[caseId] ?? ""}</b>

${findings[0].slice(0,250)}

📅 ${formatDateRu(now)}`);
      }
    }
  }

  state.updatedAt = now;
  writeState(state);

  const msg = `🏔️ <b>Montenegro Monitor — проверка завершена</b>\n✅ ${sourcesOk}/${sourcesChecked} источников онлайн\n⚖️ Обновлений по делам: ${caseUpdatesAdded}\n🕐 ${formatDateRu(now)}`;
  await sendTelegram(msg);

  return NextResponse.json({ ok: true, sourcesChecked, sourcesOnline: sourcesOk, caseUpdatesAdded, updatedAt: formatDateRu(now) });
}
